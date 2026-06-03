use serde_json::Value;
use sqlx::PgPool;

use crate::data::cards::get_cards_by_ids;
use crate::domain::types::{Card, RankedCard, RecommendationResult, RewardCategory, RewardRule};
use crate::error::AppError;

const DEFAULT_AMOUNT: f64 = 1.0;

pub async fn recommend_card(
    pool: &PgPool,
    owned_card_ids: &[String],
    category: RewardCategory,
    amount: Option<f64>,
) -> Result<RecommendationResult, AppError> {
    let amount = amount.unwrap_or(DEFAULT_AMOUNT);
    let unique: Vec<String> = {
        let mut seen = std::collections::HashSet::new();
        owned_card_ids
            .iter()
            .filter(|id| seen.insert((*id).clone()))
            .cloned()
            .collect()
    };

    let fetched = get_cards_by_ids(pool, &unique).await?;
    let card_by_id: std::collections::HashMap<&String, &Card> =
        fetched.iter().map(|c| (&c.id, c)).collect();

    let mut owned_cards: Vec<&Card> = Vec::with_capacity(unique.len());
    let mut unknown: Vec<String> = Vec::new();
    for id in &unique {
        match card_by_id.get(id) {
            Some(c) => owned_cards.push(c),
            None => unknown.push(id.clone()),
        }
    }

    if !unknown.is_empty() {
        return Err(AppError::bad_request("Unknown card id provided.")
            .with_details(serde_json::json!({ "unknownCardIds": unknown })));
    }

    if owned_cards.is_empty() {
        return Err(AppError::bad_request(
            "At least one owned card id is required.",
        ));
    }

    let mut scored: Vec<ScoredCard> = owned_cards
        .into_iter()
        .map(|card| score_card(card, category, amount))
        .collect::<Result<Vec<_>, _>>()?;

    scored.sort_by(compare_scored);

    let mut iter = scored.into_iter();
    let best = iter.next().unwrap();
    let alternatives = iter.map(|s| s.ranked).collect();
    let _: Value = Value::Null; // silence unused import in some configs

    Ok(RecommendationResult { best_card: best.ranked, alternatives })
}

struct ScoredCard {
    card_name: String,
    card_id: String,
    ranked: RankedCard,
    rule_rate: f64,
    rule_has_cap: bool,
    used_fallback: bool,
}

fn score_card(card: &Card, category: RewardCategory, amount: f64) -> Result<ScoredCard, AppError> {
    let matching = card.reward_rules.iter().find(|r| r.category == category);
    let fallback = card
        .reward_rules
        .iter()
        .find(|r| r.category == RewardCategory::General);
    let rule: &RewardRule = match matching.or(fallback) {
        Some(r) => r,
        None => {
            return Err(AppError::internal(format!(
                "Card {} has no usable reward rule.",
                card.id
            )))
        }
    };

    let estimated = estimate_rewards(rule, amount);

    Ok(ScoredCard {
        card_name: card.name.clone(),
        card_id: card.id.clone(),
        rule_rate: rule.rate,
        rule_has_cap: rule.cap.is_some(),
        used_fallback: matching.is_none(),
        ranked: RankedCard {
            id: card.id.clone(),
            name: card.name.clone(),
            issuer: card.issuer.clone(),
            reward_rate: rule.rate,
            reward_type: rule.reward_type,
            estimated_rewards: estimated,
            matched_category: rule.category,
            notes: rule.notes.clone(),
        },
    })
}

fn compare_scored(left: &ScoredCard, right: &ScoredCard) -> std::cmp::Ordering {
    // Higher rate first.
    let rate_cmp = right
        .rule_rate
        .partial_cmp(&left.rule_rate)
        .unwrap_or(std::cmp::Ordering::Equal);
    if rate_cmp != std::cmp::Ordering::Equal {
        return rate_cmp;
    }
    // Rule with cap is preferred LESS (matches TS: capDifference = leftHasCap - rightHasCap).
    let cap_diff = (left.rule_has_cap as i32) - (right.rule_has_cap as i32);
    if cap_diff != 0 {
        return cap_diff.cmp(&0);
    }
    // Non-fallback preferred.
    let fb_diff = (left.used_fallback as i32) - (right.used_fallback as i32);
    if fb_diff != 0 {
        return fb_diff.cmp(&0);
    }
    let name_cmp = left.card_name.cmp(&right.card_name);
    if name_cmp != std::cmp::Ordering::Equal {
        return name_cmp;
    }
    left.card_id.cmp(&right.card_id)
}

fn estimate_rewards(rule: &RewardRule, amount: f64) -> f64 {
    let raw = match rule.reward_type {
        crate::domain::types::RewardType::CashbackPercent => amount * (rule.rate / 100.0),
        _ => amount * rule.rate,
    };
    (raw * 100.0).round() / 100.0
}
