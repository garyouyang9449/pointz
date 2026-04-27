import cors from "@fastify/cors";
import Fastify from "fastify";
import { registerRoutes } from "./routes/index.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(registerRoutes);

  return app;
}
