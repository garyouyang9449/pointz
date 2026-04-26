import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerCardRoutes } from "./routes/cards.js";
import { registerCategoryRoutes } from "./routes/categories.js";
import { registerRecommendRoutes } from "./routes/recommend.js";
export async function buildApp() {
    const app = Fastify({ logger: true });
    await app.register(cors, { origin: true });
    app.get("/health", async () => ({ status: "ok" }));
    await app.register(registerCardRoutes);
    await app.register(registerCategoryRoutes);
    await app.register(registerRecommendRoutes);
    return app;
}
