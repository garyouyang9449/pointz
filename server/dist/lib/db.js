import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";
const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL environment variable is required.");
}
// RDS Postgres requires SSL (rds.force_ssl=1). Enable it whenever the URL
// targets an *.rds.amazonaws.com host, or when PGSSL=true is set explicitly.
// We don't verify the cert because RDS uses a private CA that isn't bundled
// with node-pg by default; the connection is still encrypted in transit.
const useSsl = process.env.PGSSL === "true" ||
    /\.rds\.amazonaws\.com(:|\/|$)/i.test(connectionString);
export const pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });
