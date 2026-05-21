import { sql } from "drizzle-orm";
import { bigserial, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
export const cards = pgTable("cards", {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    name: text("name").notNull(),
    network: text("network"),
    annualFee: integer("annual_fee")
});
export const rewardRules = pgTable("reward_rules", {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    cardId: text("card_id")
        .notNull()
        .references(() => cards.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    rate: numeric("rate").notNull(),
    rewardType: text("reward_type").notNull(),
    capAmount: numeric("cap_amount"),
    capPeriod: text("cap_period"),
    notes: text("notes")
}, (t) => ({
    cardCategoryUnique: unique("reward_rules_card_id_category_unique").on(t.cardId, t.category)
}));
export const users = pgTable("users", {
    id: uuid("id")
        .primaryKey()
        .default(sql `gen_random_uuid()`),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    preferences: jsonb("preferences")
        .$type()
        .notNull()
        .default({})
});
export const userOwnedCards = pgTable("user_owned_cards", {
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    cardId: text("card_id")
        .notNull()
        .references(() => cards.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true })
        .notNull()
        .defaultNow()
}, (t) => ({
    pk: primaryKey({ columns: [t.userId, t.cardId] })
}));
