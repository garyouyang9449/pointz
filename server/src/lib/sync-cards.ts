import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { pool } from "./db.js";
import { categoryIds } from "../data/categories.js";

/**
 * Weekly card-catalog sync.
 *
 * Resolves the dataset from (in order):
 *   1. `CARDS_DATA_URL` env var — http(s) URL returning the JSON schema below.
 *   2. `CARDS_DATA_FILE` env var — absolute path to a local JSON file.
 *   3. `<cwd>/db/cards-dataset.json` — the in-repo default.
 *
 * Why this shape: there is no high-quality free public API for US credit-card
 * rewards. The most maintainable free path is a versioned JSON dataset (local
 * or remote) that this script validates and upserts. If a real API appears,
 * swap the loader; the rest of the pipeline is unchanged.
 *
 * Behavior:
 *   - All writes happen in a single transaction.
 *   - Cards & rules are upserted by primary key / (card_id, category).
 *   - Reward rules for a card present in the dataset are *replaced* (so a rule
 *     removed upstream is removed locally).
 *   - Cards missing from the dataset are NOT deleted by default. Pass
 *     `--prune` or set `CARDS_SYNC_PRUNE=true` to also delete unknown cards.
 */

const categoryEnum = z.enum(categoryIds as [string, ...string[]]);
const rewardTypeEnum = z.enum(["points", "miles", "cashback_percent"]);
const networkEnum = z.enum(["visa", "mastercard", "amex", "discover"]);
const capPeriodEnum = z.enum(["month", "quarter", "year"]);

const rewardRuleSchema = z.object({
  category: categoryEnum,
  rate: z.number().positive(),
  rewardType: rewardTypeEnum,
  cap: z
    .object({
      amount: z.number().positive(),
      period: capPeriodEnum
    })
    .optional(),
  notes: z.string().min(1).optional()
});

const cardSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, "id must be kebab-case"),
  issuer: z.string().min(1),
  name: z.string().min(1),
  network: networkEnum.optional(),
  annualFee: z.number().int().nonnegative().optional(),
  rewardRules: z.array(rewardRuleSchema).min(1)
});

const datasetSchema = z.object({
  version: z.string().min(1),
  source: z.string().optional(),
  cards: z.array(cardSchema).min(1)
});

export type CardsDataset = z.infer<typeof datasetSchema>;

async function loadDataset(): Promise<CardsDataset> {
  const url = process.env.CARDS_DATA_URL;
  if (url) {
    // eslint-disable-next-line no-console
    console.log(`Fetching dataset from ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
    }
    const json = await res.json();
    return datasetSchema.parse(json);
  }

  const file =
    process.env.CARDS_DATA_FILE ??
    resolve(process.cwd(), "db/cards-dataset.json");
  // eslint-disable-next-line no-console
  console.log(`Loading dataset from ${file}`);
  const raw = await readFile(file, "utf8");
  return datasetSchema.parse(JSON.parse(raw));
}

interface SyncStats {
  cardsUpserted: number;
  rulesUpserted: number;
  rulesDeleted: number;
  cardsDeleted: number;
}

async function syncCards(
  dataset: CardsDataset,
  { prune }: { prune: boolean }
): Promise<SyncStats> {
  const stats: SyncStats = {
    cardsUpserted: 0,
    rulesUpserted: 0,
    rulesDeleted: 0,
    cardsDeleted: 0
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const card of dataset.cards) {
      await client.query(
        `INSERT INTO cards (id, issuer, name, network, annual_fee)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           issuer = EXCLUDED.issuer,
           name = EXCLUDED.name,
           network = EXCLUDED.network,
           annual_fee = EXCLUDED.annual_fee`,
        [
          card.id,
          card.issuer,
          card.name,
          card.network ?? null,
          card.annualFee ?? null
        ]
      );
      stats.cardsUpserted += 1;

      const keepCategories = card.rewardRules.map((r) => r.category);
      const deleted = await client.query(
        `DELETE FROM reward_rules
         WHERE card_id = $1 AND category <> ALL($2::text[])`,
        [card.id, keepCategories]
      );
      stats.rulesDeleted += deleted.rowCount ?? 0;

      for (const rule of card.rewardRules) {
        await client.query(
          `INSERT INTO reward_rules
             (card_id, category, rate, reward_type, cap_amount, cap_period, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (card_id, category) DO UPDATE SET
             rate = EXCLUDED.rate,
             reward_type = EXCLUDED.reward_type,
             cap_amount = EXCLUDED.cap_amount,
             cap_period = EXCLUDED.cap_period,
             notes = EXCLUDED.notes`,
          [
            card.id,
            rule.category,
            rule.rate,
            rule.rewardType,
            rule.cap?.amount ?? null,
            rule.cap?.period ?? null,
            rule.notes ?? null
          ]
        );
        stats.rulesUpserted += 1;
      }
    }

    if (prune) {
      const keepIds = dataset.cards.map((c) => c.id);
      const deleted = await client.query(
        `DELETE FROM cards WHERE id <> ALL($1::text[])`,
        [keepIds]
      );
      stats.cardsDeleted = deleted.rowCount ?? 0;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return stats;
}

async function main() {
  const prune =
    process.argv.includes("--prune") || process.env.CARDS_SYNC_PRUNE === "true";

  const dataset = await loadDataset();
  // eslint-disable-next-line no-console
  console.log(
    `Dataset version=${dataset.version} cards=${dataset.cards.length}` +
      (prune ? " (prune mode: unknown cards will be deleted)" : "")
  );

  const stats = await syncCards(dataset, { prune });
  // eslint-disable-next-line no-console
  console.log(
    `Sync complete. cardsUpserted=${stats.cardsUpserted} ` +
      `rulesUpserted=${stats.rulesUpserted} ` +
      `rulesDeleted=${stats.rulesDeleted} ` +
      `cardsDeleted=${stats.cardsDeleted}`
  );

  await pool.end();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Sync failed:", err);
  process.exit(1);
});
