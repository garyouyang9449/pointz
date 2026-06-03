use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Hash)]
#[serde(rename_all = "snake_case")]
pub enum RewardCategory {
    Dining,
    Groceries,
    Gas,
    Travel,
    Transit,
    Drugstores,
    Streaming,
    General,
}

impl RewardCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            RewardCategory::Dining => "dining",
            RewardCategory::Groceries => "groceries",
            RewardCategory::Gas => "gas",
            RewardCategory::Travel => "travel",
            RewardCategory::Transit => "transit",
            RewardCategory::Drugstores => "drugstores",
            RewardCategory::Streaming => "streaming",
            RewardCategory::General => "general",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        Some(match s {
            "dining" => RewardCategory::Dining,
            "groceries" => RewardCategory::Groceries,
            "gas" => RewardCategory::Gas,
            "travel" => RewardCategory::Travel,
            "transit" => RewardCategory::Transit,
            "drugstores" => RewardCategory::Drugstores,
            "streaming" => RewardCategory::Streaming,
            "general" => RewardCategory::General,
            _ => return None,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RewardType {
    Points,
    Miles,
    #[serde(rename = "cashback_percent")]
    CashbackPercent,
}

impl RewardType {
    pub fn from_str(s: &str) -> Option<Self> {
        Some(match s {
            "points" => RewardType::Points,
            "miles" => RewardType::Miles,
            "cashback_percent" => RewardType::CashbackPercent,
            _ => return None,
        })
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            RewardType::Points => "points",
            RewardType::Miles => "miles",
            RewardType::CashbackPercent => "cashback_percent",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CardNetwork {
    Visa,
    Mastercard,
    Amex,
    Discover,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CapPeriod {
    Month,
    Quarter,
    Year,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RewardCap {
    pub amount: f64,
    pub period: CapPeriod,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RewardRule {
    pub category: RewardCategory,
    pub rate: f64,
    #[serde(rename = "rewardType")]
    pub reward_type: RewardType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cap: Option<RewardCap>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Card {
    pub id: String,
    pub issuer: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network: Option<String>,
    #[serde(rename = "annualFee", skip_serializing_if = "Option::is_none")]
    pub annual_fee: Option<i32>,
    #[serde(rename = "rewardRules")]
    pub reward_rules: Vec<RewardRule>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RankedCard {
    pub id: String,
    pub name: String,
    pub issuer: String,
    #[serde(rename = "rewardRate")]
    pub reward_rate: f64,
    #[serde(rename = "rewardType")]
    pub reward_type: RewardType,
    #[serde(rename = "estimatedRewards")]
    pub estimated_rewards: f64,
    #[serde(rename = "matchedCategory")]
    pub matched_category: RewardCategory,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RecommendationResult {
    #[serde(rename = "bestCard")]
    pub best_card: RankedCard,
    pub alternatives: Vec<RankedCard>,
}
