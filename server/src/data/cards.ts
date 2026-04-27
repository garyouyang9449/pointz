import { inArray } from "drizzle-orm";
import { db } from "../lib/db.js";
import { cards as cardsTable, rewardRules as rewardRulesTable } from "../lib/schema.js";
import type { CardRow, RewardRuleRow } from "../lib/schema.js";
import type { Card, CardNetwork, RewardCap, RewardCategory, RewardRule, RewardType } from "../types.js";

function toRewardRule(row: RewardRuleRow): RewardRule {
  const rule: RewardRule = {
    category: row.category as RewardCategory,
    rate: Number(row.rate),
    rewardType: row.rewardType as RewardType
  };

  if (row.capAmount !== null && row.capPeriod !== null) {
    rule.cap = {
      amount: Number(row.capAmount),
      period: row.capPeriod as RewardCap["period"]
    };
  }

  if (row.notes !== null) {
    rule.notes = row.notes;
  }

  return rule;
}

function toCard(row: CardRow, rules: RewardRule[]): Card {
  const card: Card = {
    id: row.id,
    issuer: row.issuer,
    name: row.name,
    rewardRules: rules
  };

  if (row.network !== null) {
    card.network = row.network as CardNetwork;
  }

  if (row.annualFee !== null) {
    card.annualFee = row.annualFee;
  }

  return card;
}

async function assembleCards(cardRows: CardRow[]): Promise<Card[]> {
  if (cardRows.length === 0) {
    return [];
  }

  const ids = cardRows.map((row) => row.id);
  const ruleRows = await db
    .select()
    .from(rewardRulesTable)
    .where(inArray(rewardRulesTable.cardId, ids))
    .orderBy(rewardRulesTable.id);

  const rulesByCardId = new Map<string, RewardRule[]>();
  for (const row of ruleRows) {
    const rule = toRewardRule(row);
    const existing = rulesByCardId.get(row.cardId);
    if (existing) {
      existing.push(rule);
    } else {
      rulesByCardId.set(row.cardId, [rule]);
    }
  }

  return cardRows.map((row) => toCard(row, rulesByCardId.get(row.id) ?? []));
}

export async function getCards(): Promise<Card[]> {
  const cardRows = await db.select().from(cardsTable).orderBy(cardsTable.name);
  return assembleCards(cardRows);
}

export async function getCardsByIds(ids: string[]): Promise<Card[]> {
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
