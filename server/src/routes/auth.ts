import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  authenticate,
  hashPassword,
  verifyPassword
} from "../lib/auth.js";
import { db } from "../lib/db.js";
import { users, type UserPreferences } from "../lib/schema.js";

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(200)
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Default preferences for newly-created users. The user is presumed to have
// agreed to share their location during signup, so we record the consent here
// to avoid re-prompting on subsequent sessions / devices.
const DEFAULT_USER_PREFERENCES: UserPreferences = {
  locationConsent: "granted"
};

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post("/auth/signup", async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "Invalid signup request.", details: parsed.error.flatten() });
    }

    const email = normalizeEmail(parsed.data.email);

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return reply.status(409).send({ error: "An account with that email already exists." });
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const [created] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        preferences: DEFAULT_USER_PREFERENCES
      })
      .returning({
        id: users.id,
        email: users.email,
        preferences: users.preferences
      });

    if (!created) {
      return reply.status(500).send({ error: "Could not create account." });
    }

    const token = await reply.jwtSign(
      { sub: created.id, email: created.email },
      { expiresIn: "7d" }
    );

    return reply.status(201).send({
      token,
      user: {
        id: created.id,
        email: created.email,
        preferences: created.preferences ?? {}
      }
    });
  });

  app.post("/auth/login", async (request, reply) => {
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .status(400)
        .send({ error: "Invalid login request.", details: parsed.error.flatten() });
    }

    const email = normalizeEmail(parsed.data.email);

    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        passwordHash: users.passwordHash,
        preferences: users.preferences
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!row) {
      return reply.status(401).send({ error: "Invalid email or password." });
    }

    const ok = await verifyPassword(parsed.data.password, row.passwordHash);
    if (!ok) {
      return reply.status(401).send({ error: "Invalid email or password." });
    }

    const token = await reply.jwtSign(
      { sub: row.id, email: row.email },
      { expiresIn: "7d" }
    );

    return {
      token,
      user: {
        id: row.id,
        email: row.email,
        preferences: row.preferences ?? {}
      }
    };
  });

  app.get(
    "/auth/me",
    { preHandler: authenticate },
    async (request, reply) => {
      const [row] = await db
        .select({
          id: users.id,
          email: users.email,
          preferences: users.preferences
        })
        .from(users)
        .where(eq(users.id, request.user.id))
        .limit(1);

      if (!row) {
        return reply.status(404).send({ error: "User not found." });
      }

      return {
        user: {
          id: row.id,
          email: row.email,
          preferences: row.preferences ?? {}
        }
      };
    }
  );
}
