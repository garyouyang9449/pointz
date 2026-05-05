import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import Fastify from "fastify";
import { registerRoutes } from "./routes/index.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerOwnedCardsRoutes } from "./routes/owned-cards.js";

export async function buildApp() {
  const app = Fastify({ logger: true });

  const allowedOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: allowedOrigins.length > 0 ? allowedOrigins : true
  });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 16) {
    throw new Error(
      "JWT_SECRET environment variable is required (min 16 characters)."
    );
  }

  await app.register(jwt, { secret: jwtSecret });

  app.get("/health", async () => ({ status: "ok" }));

  await app.register(
    async (api) => {
      await api.register(registerAuthRoutes);
      await api.register(registerOwnedCardsRoutes);
      await api.register(registerRoutes);
    },
    { prefix: "/api" }
  );

  return app;
}
