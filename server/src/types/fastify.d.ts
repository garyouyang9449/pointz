import "fastify";
import type { AuthenticatedUser, AuthTokenPayload } from "../lib/auth.js";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AuthTokenPayload;
    // After the `authenticate` preHandler runs we normalize the JWT payload
    // into AuthenticatedUser and replace request.user with it.
    user: AuthenticatedUser;
  }
}
