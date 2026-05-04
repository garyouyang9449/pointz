import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "postgres://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "./src/lib/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url
  },
  strict: true,
  verbose: true
});
