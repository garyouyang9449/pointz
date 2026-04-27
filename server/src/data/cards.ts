import { pool } from "../lib/db.js";
import type { Card, CardNetwork, RewardCap, RewardCategory, RewardRule, RewardType } from "../types.js";

interface CardRow {
  id: string;
  issuer: string;
  name: string;
  network: string | null;
  annual_fee: number | string | null;
}

interface RewardRuleRow {
  card_id: string;
  category: string;
  rate: number | string;
  reward_type: string;
  cap_amount: number | string | null;
  cap_period: string | null;
  notes: string | null;
}

function toRewardRule(row: RewardRuleRow): RewardRule {
  const rule: RewardRule = {
    category: row.category as RewardCategory,
    rate: Number(row.rate),
    rewardType: row.reward_type as RewardType
  };

  if (row.cap_amount !== null && row.cap_period !== null) {
    rule.cap = {
      amount: Number(row.cap_amount),
      period: row.cap_period as RewardCap["period"]
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

  if (row.annual_fee !== null) {
    card.annualFee = Number(row.annual_fee);
  }

  return card;
}

async function fetchCards(cardWhereSql: string, params: unknown[]): Promise<Card[]> {
  const cardsResult = await pool.query<CardRow>(
    `SELECT id, issuer, name, network, annual_fee
       FROM cards
       ${cardWhereSql}
       ORDER BY name`,
    params
  );

  if (cardsResult.rows.length === 0) {
    return [];
  }

  const ids = cardsResult.rows.map((row) => row.id);
  const rulesResult = await pool.query<RewardRuleRow>(
    `SELECT card_id, category, rate, reward_type, cap_amount, cap_period, notes
       FROM reward_rules
       WHERE card_id = ANY($1::text[])
       ORDER BY id`,
    [ids]
  );

  const rulesByCardId = new Map<string, RewardRule[]>();
  for (const row of rulesResult.rows) {
    const existing = rulesByCardId.get(row.card_id);
    const rule = toRewardRule(row);
    if (existing) {
      existing.push(rule);
    } else {
      rulesByCardId.set(row.card_id, [rule]);
    }
  }

  return cardsResult.rows.map((row) => toCard(row, rulesByCardId.get(row.id) ?? []));
}

export async function getCards(): Promise<Card[]> {
  return fetchCards("", []);
}

export async function getCardsByIds(ids: string[]): Promise<Card[]> {
  if (ids.length === 0) {
    return [];
  }
  return fetchCards("WHERE id = ANY($1::text[])", [ids]);
}
