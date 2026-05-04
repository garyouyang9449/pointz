import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getCards } from "../data/cards.js";
import { categories, categoryIds } from "../data/categories.js";
import { detectCategoryFromLocation } from "../lib/location.js";
import { RecommendationError, recommendCard } from "../lib/recommend.js";
import type { RewardCategory } from "../types.js";

const recommendRequestSchema = z.object({
  ownedCardIds: z.array(z.string().min(1)).min(1),
  category: z.enum(categoryIds as [string, ...string[]]),
  amount: z.number().positive().finite().optional()
});

const recommendByLocationSchema = z.object({
  ownedCardIds: z.array(z.string().min(1)).min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  amount: z.number().positive().finite().optional()
});

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/cards", async () => ({ cards: await getCards() }));

  app.get("/categories", async () => ({ categories }));

  app.post("/recommend", async (request, reply) => {
    const parsed = recommendRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid recommendation request.",
        details: parsed.error.flatten()
      });
    }

    try {
      return await recommendCard({ ...parsed.data, category: parsed.data.category as RewardCategory });
    } catch (error) {
      if (error instanceof RecommendationError) {
        return reply.status(error.statusCode).send({ error: error.message, details: error.details });
      }

      throw error;
    }
  });

  app.post("/recommend-by-location", async (request, reply) => {
    const parsed = recommendByLocationSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid location recommendation request.",
        details: parsed.error.flatten()
      });
    }

    const { ownedCardIds, lat, lng, amount } = parsed.data;

    try {
      const place = await detectCategoryFromLocation(lat, lng);
      const recommendation = await recommendCard({
        ownedCardIds,
        category: place.category,
        ...(amount !== undefined ? { amount } : {})
      });

      return { ...recommendation, place };
    } catch (error) {
      if (error instanceof RecommendationError) {
        return reply.status(error.statusCode).send({ error: error.message, details: error.details });
      }

      throw error;
    }
  });
}
