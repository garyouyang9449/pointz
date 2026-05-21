import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "./db.js";
async function main() {
    const sqlPath = resolve(process.cwd(), "db/init.sql");
    // eslint-disable-next-line no-console
    console.log(`Seeding catalog from ${sqlPath}...`);
    const sql = await readFile(sqlPath, "utf8");
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("COMMIT");
    }
    catch (err) {
        await client.query("ROLLBACK");
        throw err;
    }
    finally {
        client.release();
    }
    const { rows } = await pool.query("SELECT (SELECT COUNT(*) FROM cards)::text AS cards, (SELECT COUNT(*) FROM reward_rules)::text AS rules");
    // eslint-disable-next-line no-console
    console.log(`Seed complete. cards=${rows[0]?.cards ?? "?"} reward_rules=${rows[0]?.rules ?? "?"}`);
    await pool.end();
}
main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Seed failed:", err);
    process.exit(1);
});
