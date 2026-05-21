import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { authenticate } from "../lib/auth.js";
import { db } from "../lib/db.js";
import { cards, userOwnedCards } from "../lib/schema.js";
const setOwnedSchema = z.object({
    cardIds: z.array(z.string().min(1)).max(100)
});
async function getUserCardIds(userId) {
    const rows = await db
        .select({ cardId: userOwnedCards.cardId })
        .from(userOwnedCards)
        .where(eq(userOwnedCards.userId, userId));
    return rows.map((r) => r.cardId);
}
async function assertCardsExist(ids) {
    if (ids.length === 0)
        return;
    const found = await db
        .select({ id: cards.id })
        .from(cards)
        .where(inArray(cards.id, ids));
    if (found.length !== new Set(ids).size) {
        const foundSet = new Set(found.map((r) => r.id));
        const missing = ids.filter((id) => !foundSet.has(id));
        const err = new Error(`Unknown card id(s): ${missing.join(", ")}`);
        err.statusCode = 400;
        throw err;
    }
}
export async function registerOwnedCardsRoutes(app) {
    app.get("/me/owned-cards", { preHandler: authenticate }, async (request) => {
        const ids = await getUserCardIds(request.user.id);
        return { cardIds: ids };
    });
    app.put("/me/owned-cards", { preHandler: authenticate }, async (request, reply) => {
        const parsed = setOwnedSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply
                .status(400)
                .send({ error: "Invalid request.", details: parsed.error.flatten() });
        }
        const userId = request.user.id;
        const dedup = Array.from(new Set(parsed.data.cardIds));
        try {
            await assertCardsExist(dedup);
        }
        catch (err) {
            const e = err;
            return reply.status(e.statusCode ?? 400).send({ error: e.message });
        }
        // Replace the user's set in a transaction.
        await db.transaction(async (tx) => {
            await tx.delete(userOwnedCards).where(eq(userOwnedCards.userId, userId));
            if (dedup.length > 0) {
                await tx
                    .insert(userOwnedCards)
                    .values(dedup.map((cardId) => ({ userId, cardId })));
            }
        });
        return { cardIds: dedup };
    });
    app.post("/me/owned-cards/:cardId", { preHandler: authenticate }, async (request, reply) => {
        const params = z.object({ cardId: z.string().min(1) }).safeParse(request.params);
        if (!params.success) {
            return reply.status(400).send({ error: "Invalid card id." });
        }
        const { cardId } = params.data;
        const userId = request.user.id;
        try {
            await assertCardsExist([cardId]);
        }
        catch (err) {
            const e = err;
            return reply.status(e.statusCode ?? 400).send({ error: e.message });
        }
        await db
            .insert(userOwnedCards)
            .values({ userId, cardId })
            .onConflictDoNothing();
        const ids = await getUserCardIds(userId);
        return { cardIds: ids };
    });
    app.delete("/me/owned-cards/:cardId", { preHandler: authenticate }, async (request, reply) => {
        const params = z.object({ cardId: z.string().min(1) }).safeParse(request.params);
        if (!params.success) {
            return reply.status(400).send({ error: "Invalid card id." });
        }
        const { cardId } = params.data;
        const userId = request.user.id;
        await db
            .delete(userOwnedCards)
            .where(and(eq(userOwnedCards.userId, userId), eq(userOwnedCards.cardId, cardId)));
        const ids = await getUserCardIds(userId);
        return { cardIds: ids };
    });
}
