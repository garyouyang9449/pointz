import { eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { users, type UserPreferences } from "../lib/schema.js";

const locationConsentSchema = z.enum(["granted", "denied"]);

// Patch body. Every preference field is optional so the client can update a
// subset; unknown keys are rejected to surface client/server drift early.
const patchPreferencesSchema = z
  .object({
    locationConsent: locationConsentSchema.optional()
  })
  .strict();

export async function registerPreferencesRoutes(
  app: FastifyInstance
): Promise<void> {
  app.patch(
    "/me/preferences",
    { preHandler: authenticate },
    async (request, reply) => {
      const parsed = patchPreferencesSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Invalid preferences update.",
          details: parsed.error.flatten()
        });
      }

      // No-op patch: return current preferences unchanged.
      if (Object.keys(parsed.data).length === 0) {
        const [row] = await db
          .select({ preferences: users.preferences })
          .from(users)
          .where(eq(users.id, request.user.id))
          .limit(1);
        if (!row) return reply.status(404).send({ error: "User not found." });
        return { preferences: (row.preferences ?? {}) as UserPreferences };
      }

      // Merge the supplied fields into the existing JSONB so callers don't
      // need to round-trip the entire preferences object.
      const [updated] = await db
        .update(users)
        .set({
          preferences: sql`${users.preferences} || ${JSON.stringify(parsed.data)}::jsonb`
        })
        .where(eq(users.id, request.user.id))
        .returning({ preferences: users.preferences });

      if (!updated) {
        return reply.status(404).send({ error: "User not found." });
      }

      return { preferences: (updated.preferences ?? {}) as UserPreferences };
    }
  );
}
