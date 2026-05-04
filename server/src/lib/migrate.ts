import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./db.js";

async function main() {
  // eslint-disable-next-line no-console
  console.log("Running migrations from ./db/migrations...");
  await migrate(db, { migrationsFolder: "./db/migrations" });
  // eslint-disable-next-line no-console
  console.log("Migrations complete.");
  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Migration failed:", err);
  process.exit(1);
});
