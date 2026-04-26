import { z } from "zod";
import { categoryIds } from "../data/categories.js";
import { RecommendationError, recommendCard } from "../lib/recommend.js";
const recommendRequestSchema = z.object({
    ownedCardIds: z.array(z.string().min(1)).min(1),
    category: z.enum(categoryIds),
    amount: z.number().positive().finite().optional()
});
export async function registerRecommendRoutes(app) {
    app.post("/recommend", async (request, reply) => {
        const parsed = recommendRequestSchema.safeParse(request.body);
        if (!parsed.success) {
            return reply.status(400).send({
                error: "Invalid recommendation request.",
                details: parsed.error.flatten()
            });
        }
        try {
            return recommendCard({ ...parsed.data, category: parsed.data.category });
        }
        catch (error) {
            if (error instanceof RecommendationError) {
                return reply.status(error.statusCode).send({ error: error.message, details: error.details });
            }
            throw error;
        }
    });
}
