import type { FastifyInstance } from "fastify";
import { categories } from "../data/categories.js";

export async function registerCategoryRoutes(app: FastifyInstance): Promise<void> {
  app.get("/categories", async () => ({ categories }));
}
