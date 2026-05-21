import bcrypt from "bcrypt";
const BCRYPT_ROUNDS = 12;
export class AuthError extends Error {
    statusCode;
    details;
    constructor(message, statusCode = 400, details) {
        super(message);
        this.name = "AuthError";
        this.statusCode = statusCode;
        this.details = details;
    }
}
export async function hashPassword(plain) {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
export async function verifyPassword(plain, hash) {
    return bcrypt.compare(plain, hash);
}
/**
 * Fastify preHandler: verifies the bearer token, attaches the resolved user
 * to `request.user`. Replies with 401 on failure.
 */
export async function authenticate(request, reply) {
    try {
        await request.jwtVerify();
        const payload = request.user;
        if (!payload?.sub || !payload?.email) {
            throw new Error("Invalid token payload");
        }
        // Replace the verified payload with our normalized shape.
        request.user = {
            id: payload.sub,
            email: payload.email
        };
    }
    catch (err) {
        request.log.warn({ err }, "JWT verification failed");
        return reply.status(401).send({ error: "Unauthorized" });
    }
}
