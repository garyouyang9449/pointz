import { integer, numeric, pgTable, serial, text } from "drizzle-orm/pg-core";

export const cards = pgTable("cards", {
  id: text("id").primaryKey(),
  issuer: text("issuer").notNull(),
  name: text("name").notNull(),
  network: text("network"),
  annualFee: integer("annual_fee")
});

export const rewardRules = pgTable("reward_rules", {
  id: serial("id").primaryKey(),
  cardId: text("card_id")
    .notNull()
    .references(() => cards.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  rate: numeric("rate").notNull(),
  rewardType: text("reward_type").notNull(),
  capAmount: numeric("cap_amount"),
  capPeriod: text("cap_period"),
  notes: text("notes")
});

export type CardRow = typeof cards.$inferSelect;
export type RewardRuleRow = typeof rewardRules.$inferSelect;
