import { inArray } from "drizzle-orm";
import { db } from "../lib/db.js";
import { cards as cardsTable, rewardRules as rewardRulesTable } from "../lib/schema.js";
function toRewardRule(row) {
    const rule = {
        category: row.category,
        rate: Number(row.rate),
        rewardType: row.rewardType
    };
    if (row.capAmount !== null && row.capPeriod !== null) {
        rule.cap = {
            amount: Number(row.capAmount),
            period: row.capPeriod
        };
    }
    if (row.notes !== null) {
        rule.notes = row.notes;
    }
    return rule;
}
function toCard(row, rules) {
    const card = {
        id: row.id,
        issuer: row.issuer,
        name: row.name,
        rewardRules: rules
    };
    if (row.network !== null) {
        card.network = row.network;
    }
    if (row.annualFee !== null) {
        card.annualFee = row.annualFee;
    }
    return card;
}
async function assembleCards(cardRows) {
    if (cardRows.length === 0) {
        return [];
    }
    const ids = cardRows.map((row) => row.id);
    const ruleRows = await db
        .select()
        .from(rewardRulesTable)
        .where(inArray(rewardRulesTable.cardId, ids))
        .orderBy(rewardRulesTable.id);
    const rulesByCardId = new Map();
    for (const row of ruleRows) {
        const rule = toRewardRule(row);
        const existing = rulesByCardId.get(row.cardId);
        if (existing) {
            existing.push(rule);
        }
        else {
            rulesByCardId.set(row.cardId, [rule]);
        }
    }
    return cardRows.map((row) => toCard(row, rulesByCardId.get(row.id) ?? []));
}
export async function getCards() {
    const cardRows = await db.select().from(cardsTable).orderBy(cardsTable.name);
    return assembleCards(cardRows);
}
export async function getCardsByIds(ids) {
    if (ids.length === 0) {
        return [];
    }
    const cardRows = await db
        .select()
        .from(cardsTable)
        .where(inArray(cardsTable.id, ids))
        .orderBy(cardsTable.name);
    return assembleCards(cardRows);
}
