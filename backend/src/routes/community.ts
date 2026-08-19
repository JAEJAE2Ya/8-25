import { Prisma, type PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { AppConfig } from "../config.js";
import { getAuthUser, requireAuth } from "../lib/auth.js";
import { plannedMealDto } from "../lib/dto.js";
import { persistRecipe, recipeDto } from "../lib/recipe.js";
import { asObject, optionalString, parseDate, parseMealType, requiredNumber, requiredString } from "../lib/validation.js";

const authorSelect = { id: true, nickname: true, avatarUrl: true } as const;

type PostWithRelations = Prisma.CommunityPostGetPayload<{
  include: {
    author: { select: typeof authorSelect };
    recipe: true;
    likes: { select: { userId: true } };
    _count: { select: { likes: true; comments: true } };
  };
}>;

function postDto(post: PostWithRelations, viewerId?: string) {
  return {
    id: post.id,
    author: { id: post.author.id, nickname: post.author.nickname, avatar: post.author.avatarUrl },
    recipeId: post.recipeId,
    foodEntryId: post.foodEntryId,
    mealName: post.mealName,
    caption: post.caption,
    imageUrl: post.imageUrl,
    nutrition: {
      calories: post.calories ?? 0,
      carbs: post.carbs ?? 0,
      protein: post.protein ?? 0,
      fat: post.fat ?? 0,
    },
    recipe: post.recipe ? recipeDto(post.recipe) : null,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    likedByMe: Boolean(viewerId && post.likes.some((like) => like.userId === viewerId)),
    mine: post.authorId === viewerId,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

async function findPost(db: PrismaClient, id: string, viewerId?: string) {
  return db.communityPost.findUnique({
    where: { id },
    include: {
      author: { select: authorSelect },
      recipe: true,
      likes: { where: viewerId ? { userId: viewerId } : { userId: "__anonymous__" }, select: { userId: true } },
      _count: { select: { likes: true, comments: true } },
    },
  });
}

export function registerCommunityRoutes(app: FastifyInstance, db: PrismaClient, config: AppConfig) {
  app.get("/api/community/posts", async (request) => {
    const viewer = await getAuthUser(request, db, config);
    const posts = await db.communityPost.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        author: { select: authorSelect },
        recipe: true,
        likes: { where: viewer ? { userId: viewer.id } : { userId: "__anonymous__" }, select: { userId: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    return { posts: posts.map((post) => postDto(post, viewer?.id)) };
  });

  app.get<{ Params: { id: string } }>("/api/community/posts/:id", async (request, reply) => {
    const viewer = await getAuthUser(request, db, config);
    const post = await findPost(db, request.params.id, viewer?.id);
    if (!post) return reply.code(404).send({ error: "community_post_not_found" });
    return { post: postDto(post, viewer?.id) };
  });

  app.post("/api/community/posts", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    const body = asObject(request.body);
    const caption = requiredString(body, "caption", 2000);
    const imageUrl = optionalString(body, "imageUrl", 1000);
    const foodEntryId = optionalString(body, "foodEntryId", 100);
    const entry = foodEntryId ? await db.foodEntry.findFirst({ where: { id: foodEntryId, userId: user.id } }) : null;
    if (foodEntryId && !entry) return reply.code(404).send({ error: "food_entry_not_found" });
    const recipe = body.recipe ? await persistRecipe(db, user.id, body.recipe) : null;
    const nutrition = asObject(body.nutrition);
    const post = await db.communityPost.create({
      data: {
        authorId: user.id,
        foodEntryId: entry?.id ?? null,
        recipeId: recipe?.id ?? null,
        mealName: entry?.foodName ?? recipe?.name ?? requiredString(body, "mealName", 200),
        caption,
        imageUrl,
        calories: entry?.calories ?? recipe?.calories ?? requiredNumber(nutrition, "calories", 0, 100_000),
        carbs: entry?.carbs ?? recipe?.carbs ?? requiredNumber(nutrition, "carbs", 0, 10_000),
        protein: entry?.protein ?? recipe?.protein ?? requiredNumber(nutrition, "protein", 0, 10_000),
        fat: entry?.fat ?? recipe?.fat ?? requiredNumber(nutrition, "fat", 0, 10_000),
      },
    });
    const created = await findPost(db, post.id, user.id);
    return reply.code(201).send({ post: postDto(created!, user.id) });
  });

  app.patch<{ Params: { id: string } }>("/api/community/posts/:id", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    const owned = await db.communityPost.findFirst({ where: { id: request.params.id, authorId: user.id }, select: { id: true } });
    if (!owned) return reply.code(404).send({ error: "community_post_not_found" });
    const body = asObject(request.body);
    await db.communityPost.update({ where: { id: owned.id }, data: { caption: requiredString(body, "caption", 2000), imageUrl: optionalString(body, "imageUrl", 1000) } });
    const updated = await findPost(db, owned.id, user.id);
    return { post: postDto(updated!, user.id) };
  });

  app.delete<{ Params: { id: string } }>("/api/community/posts/:id", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    const owned = await db.communityPost.findFirst({ where: { id: request.params.id, authorId: user.id }, select: { id: true } });
    if (!owned) return reply.code(404).send({ error: "community_post_not_found" });
    await db.communityPost.delete({ where: { id: owned.id } });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>("/api/community/posts/:id/like", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    const post = await db.communityPost.findUnique({ where: { id: request.params.id }, select: { id: true } });
    if (!post) return reply.code(404).send({ error: "community_post_not_found" });
    await db.communityLike.upsert({ where: { userId_postId: { userId: user.id, postId: post.id } }, create: { userId: user.id, postId: post.id }, update: {} });
    const likeCount = await db.communityLike.count({ where: { postId: post.id } });
    return { likeCount, likedByMe: true };
  });

  app.delete<{ Params: { id: string } }>("/api/community/posts/:id/like", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    await db.communityLike.deleteMany({ where: { userId: user.id, postId: request.params.id } });
    const likeCount = await db.communityLike.count({ where: { postId: request.params.id } });
    return { likeCount, likedByMe: false };
  });

  app.get<{ Params: { id: string } }>("/api/community/posts/:id/comments", async (request, reply) => {
    const post = await db.communityPost.findUnique({ where: { id: request.params.id }, select: { id: true } });
    if (!post) return reply.code(404).send({ error: "community_post_not_found" });
    const viewer = await getAuthUser(request, db, config);
    const comments = await db.communityComment.findMany({ where: { postId: post.id }, include: { user: { select: authorSelect } }, orderBy: { createdAt: "asc" } });
    return { comments: comments.map((comment) => ({ id: comment.id, content: comment.content, author: { id: comment.user.id, nickname: comment.user.nickname, avatar: comment.user.avatarUrl }, mine: comment.userId === viewer?.id, createdAt: comment.createdAt.toISOString() })) };
  });

  app.post<{ Params: { id: string } }>("/api/community/posts/:id/comments", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    const post = await db.communityPost.findUnique({ where: { id: request.params.id }, select: { id: true } });
    if (!post) return reply.code(404).send({ error: "community_post_not_found" });
    const content = requiredString(asObject(request.body), "content", 1000);
    const comment = await db.communityComment.create({ data: { userId: user.id, postId: post.id, content } });
    return reply.code(201).send({ comment: { id: comment.id, content: comment.content, author: { id: user.id, nickname: user.nickname, avatar: user.avatarUrl }, mine: true, createdAt: comment.createdAt.toISOString() } });
  });

  app.delete<{ Params: { id: string } }>("/api/community/comments/:id", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    const owned = await db.communityComment.findFirst({ where: { id: request.params.id, userId: user.id }, select: { id: true } });
    if (!owned) return reply.code(404).send({ error: "community_comment_not_found" });
    await db.communityComment.delete({ where: { id: owned.id } });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>("/api/community/posts/:id/plan", async (request, reply) => {
    const user = await requireAuth(request, reply, db, config);
    if (!user) return;
    const body = asObject(request.body);
    const post = await db.communityPost.findUnique({ where: { id: request.params.id }, include: { recipe: true } });
    if (!post) return reply.code(404).send({ error: "community_post_not_found" });
    const date = parseDate(body.date);
    const mealType = parseMealType(body.mealType, false);
    const planned = await db.$transaction(async (tx) => {
      await tx.plannedMeal.deleteMany({ where: { userId: user.id, date, mealType } });
      return tx.plannedMeal.create({
        data: {
          userId: user.id,
          recipeId: post.recipeId,
          recipeExternalId: post.recipe?.externalId,
          recipeName: post.mealName,
          date,
          mealType,
          calories: post.calories ?? 0,
          carbs: post.carbs ?? 0,
          protein: post.protein ?? 0,
          fat: post.fat ?? 0,
        },
      });
    });
    return reply.code(201).send({ plannedMeal: plannedMealDto(planned) });
  });
}
