use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use sqlx::{PgPool, Row};

use crate::domain::types::{CapPeriod, Card, RewardCap, RewardCategory, RewardRule, RewardType};
use crate::error::{AppError, AppResult};

struct CardRow {
    id: String,
    issuer: String,
    name: String,
    network: Option<String>,
    annual_fee: Option<i32>,
}

struct RewardRuleRow {
    card_id: String,
    category: String,
    rate: Decimal,
    reward_type: String,
    cap_amount: Option<Decimal>,
    cap_period: Option<String>,
    notes: Option<String>,
}

fn to_rule(row: RewardRuleRow) -> RewardRule {
    let cap = match (row.cap_amount, row.cap_period.as_deref()) {
        (Some(amount), Some(period)) => {
            let p = match period {
                "month" => CapPeriod::Month,
                "quarter" => CapPeriod::Quarter,
                "year" => CapPeriod::Year,
                _ => CapPeriod::Year,
            };
            Some(RewardCap { amount: amount.to_f64().unwrap_or(0.0), period: p })
        }
        _ => None,
    };

    RewardRule {
        category: RewardCategory::from_str(&row.category).unwrap_or(RewardCategory::General),
        rate: row.rate.to_f64().unwrap_or(0.0),
        reward_type: RewardType::from_str(&row.reward_type).unwrap_or(RewardType::Points),
        cap,
        notes: row.notes,
    }
}

fn to_card(row: CardRow, rules: Vec<RewardRule>) -> Card {
    Card {
        id: row.id,
        issuer: row.issuer,
        name: row.name,
        network: row.network,
        annual_fee: row.annual_fee,
        reward_rules: rules,
    }
}

async fn assemble(pool: &PgPool, card_rows: Vec<CardRow>) -> AppResult<Vec<Card>> {
    if card_rows.is_empty() {
        return Ok(vec![]);
    }
    let ids: Vec<String> = card_rows.iter().map(|c| c.id.clone()).collect();

    let rule_rows = sqlx::query(
        "SELECT card_id, category, rate, reward_type, cap_amount, cap_period, notes
         FROM reward_rules
         WHERE card_id = ANY($1)
         ORDER BY id",
    )
    .bind(&ids)
    .fetch_all(pool)
    .await?;

    use std::collections::HashMap;
    let mut by_card: HashMap<String, Vec<RewardRule>> = HashMap::new();
    for r in rule_rows {
        let row = RewardRuleRow {
            card_id: r.try_get("card_id").map_err(AppError::from)?,
            category: r.try_get("category").map_err(AppError::from)?,
            rate: r.try_get("rate").map_err(AppError::from)?,
            reward_type: r.try_get("reward_type").map_err(AppError::from)?,
            cap_amount: r.try_get("cap_amount").map_err(AppError::from)?,
            cap_period: r.try_get("cap_period").map_err(AppError::from)?,
            notes: r.try_get("notes").map_err(AppError::from)?,
        };
        let card_id = row.card_id.clone();
        by_card.entry(card_id).or_default().push(to_rule(row));
    }

    Ok(card_rows
        .into_iter()
        .map(|row| {
            let rules = by_card.remove(&row.id).unwrap_or_default();
            to_card(row, rules)
        })
        .collect())
}

pub async fn get_cards(pool: &PgPool) -> AppResult<Vec<Card>> {
    let rows = sqlx::query(
        "SELECT id, issuer, name, network, annual_fee FROM cards ORDER BY name",
    )
    .fetch_all(pool)
    .await?;
    let card_rows = rows
        .into_iter()
        .map(|r| -> AppResult<CardRow> {
            Ok(CardRow {
                id: r.try_get("id")?,
                issuer: r.try_get("issuer")?,
                name: r.try_get("name")?,
                network: r.try_get("network")?,
                annual_fee: r.try_get("annual_fee")?,
            })
        })
        .collect::<AppResult<Vec<_>>>()?;
    assemble(pool, card_rows).await
}

pub async fn get_cards_by_ids(pool: &PgPool, ids: &[String]) -> AppResult<Vec<Card>> {
    if ids.is_empty() {
        return Ok(vec![]);
    }
    let rows = sqlx::query(
        "SELECT id, issuer, name, network, annual_fee FROM cards WHERE id = ANY($1) ORDER BY name",
    )
    .bind(ids)
    .fetch_all(pool)
    .await?;
    let card_rows = rows
        .into_iter()
        .map(|r| -> AppResult<CardRow> {
            Ok(CardRow {
                id: r.try_get("id")?,
                issuer: r.try_get("issuer")?,
                name: r.try_get("name")?,
                network: r.try_get("network")?,
                annual_fee: r.try_get("annual_fee")?,
            })
        })
        .collect::<AppResult<Vec<_>>>()?;
    assemble(pool, card_rows).await
}
