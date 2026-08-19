import { createHash, randomBytes } from "node:crypto";
export const SESSION_COOKIE = "mealfit_session";
export function hashSessionToken(token, secret) {
    return createHash("sha256").update(`${secret}:${token}`).digest("hex");
}
export async function createSession(db, userId, reply, config) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000);
    await db.session.create({ data: { userId, tokenHash: hashSessionToken(token, config.sessionSecret), expiresAt } });
    reply.setCookie(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: config.nodeEnv === "production",
        sameSite: "lax",
        path: "/",
        expires: expiresAt,
    });
}
export async function getAuthUser(request, db, config) {
    const token = request.cookies[SESSION_COOKIE];
    if (!token)
        return null;
    const session = await db.session.findUnique({
        where: { tokenHash: hashSessionToken(token, config.sessionSecret) },
        select: {
            id: true,
            expiresAt: true,
            user: { select: { id: true, email: true, nickname: true, avatarUrl: true, createdAt: true } },
        },
    });
    if (!session)
        return null;
    if (session.expiresAt <= new Date()) {
        await db.session.delete({ where: { id: session.id } }).catch(() => undefined);
        return null;
    }
    return session.user;
}
export async function requireAuth(request, reply, db, config) {
    const user = await getAuthUser(request, db, config);
    if (!user) {
        await reply.code(401).send({ error: "authentication_required" });
        return null;
    }
    return user;
}
export async function destroySession(request, reply, db, config) {
    const token = request.cookies[SESSION_COOKIE];
    if (token)
        await db.session.deleteMany({ where: { tokenHash: hashSessionToken(token, config.sessionSecret) } });
    reply.clearCookie(SESSION_COOKIE, { path: "/", httpOnly: true, secure: config.nodeEnv === "production", sameSite: "lax" });
}
//# sourceMappingURL=auth.js.map