import bcrypt from "bcrypt";
import type { FastifyReply, FastifyRequest } from "fastify";

const BCRYPT_ROUNDS = 12;

export class AuthError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.name = "AuthError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export interface AuthTokenPayload {
  sub: string; // user id
  email: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Fastify preHandler: verifies the bearer token, attaches the resolved user
 * to `request.user`. Replies with 401 on failure.
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    await request.jwtVerify();
    const payload = request.user as unknown as AuthTokenPayload;
    if (!payload?.sub || !payload?.email) {
      throw new Error("Invalid token payload");
    }
    // Replace the verified payload with our normalized shape.
    (request as unknown as { user: AuthenticatedUser }).user = {
      id: payload.sub,
      email: payload.email
    };
  } catch (err) {
    request.log.warn({ err }, "JWT verification failed");
    return reply.status(401).send({ error: "Unauthorized" });
  }
}
