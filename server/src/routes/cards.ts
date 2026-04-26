import type { FastifyInstance } from "fastify";
import { cards } from "../data/cards.js";

export async function registerCardRoutes(app: FastifyInstance): Promise<void> {
  app.get("/cards", async () => ({ cards }));
}
