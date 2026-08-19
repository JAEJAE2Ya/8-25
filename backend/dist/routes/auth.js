import argon2 from "argon2";
import { Prisma } from "@prisma/client";
import { createSession, destroySession, getAuthUser, requireAuth } from "../lib/auth.js";
import { asObject, requiredString, ValidationError } from "../lib/validation.js";
const safeUser = (user) => ({
    id: user.id,
    email: user.email,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
});
export function registerAuthRoutes(app, db, config) {
    app.post("/api/auth/signup", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
        const body = asObject(request.body);
        const email = requiredString(body, "email", 254).toLowerCase();
        const nickname = requiredString(body, "nickname", 30);
        const password = requiredString(body, "password", 200);
        if (!/^\S+@\S+\.\S+$/.test(email))
            throw new ValidationError("email is invalid");
        if (nickname.length < 2)
            throw new ValidationError("nickname must be at least 2 characters");
        if (password.length < 8)
            throw new ValidationError("password must be at least 8 characters");
        try {
            const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
            const user = await db.$transaction(async (tx) => {
                const created = await tx.user.create({ data: { email, nickname, passwordHash } });
                await tx.userNutritionProfile.create({ data: { userId: created.id } });
                return created;
            });
            await createSession(db, user.id, reply, config);
            return reply.code(201).send({ user: safeUser(user) });
        }
        catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
                return reply.code(409).send({ error: "email_or_nickname_already_exists" });
            }
            throw error;
        }
    });
    app.post("/api/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
        const body = asObject(request.body);
        const email = requiredString(body, "email", 254).toLowerCase();
        const password = requiredString(body, "password", 200);
        const user = await db.user.findUnique({ where: { email } });
        if (!user || !(await argon2.verify(user.passwordHash, password))) {
            return reply.code(401).send({ error: "invalid_email_or_password" });
        }
        await createSession(db, user.id, reply, config);
        return { user: safeUser(user) };
    });
    app.post("/api/auth/logout", async (request, reply) => {
        await destroySession(request, reply, db, config);
        return reply.code(204).send();
    });
    app.get("/api/auth/me", async (request, reply) => {
        const user = await getAuthUser(request, db, config);
        if (!user)
            return reply.code(401).send({ error: "authentication_required" });
        return { user: safeUser(user) };
    });
    app.delete("/api/auth/sessions", async (request, reply) => {
        const user = await requireAuth(request, reply, db, config);
        if (!user)
            return;
        await db.session.deleteMany({ where: { userId: user.id } });
        reply.clearCookie("mealfit_session", { path: "/" });
        return reply.code(204).send();
    });
}
//# sourceMappingURL=auth.js.map