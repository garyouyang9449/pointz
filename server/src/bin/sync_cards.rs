use serde::Deserialize;
use sqlx::postgres::PgPoolOptions;
use std::path::PathBuf;
use std::time::Duration;

#[derive(Debug, Deserialize)]
struct Dataset {
    version: String,
    #[serde(default)]
    source: Option<String>,
    cards: Vec<DatasetCard>,
}

#[derive(Debug, Deserialize)]
struct DatasetCard {
    id: String,
    issuer: String,
    name: String,
    #[serde(default)]
    network: Option<String>,
    #[serde(default, rename = "annualFee")]
    annual_fee: Option<i32>,
    #[serde(rename = "rewardRules")]
    reward_rules: Vec<DatasetRule>,
}

#[derive(Debug, Deserialize)]
struct DatasetRule {
    category: String,
    rate: f64,
    #[serde(rename = "rewardType")]
    reward_type: String,
    #[serde(default)]
    cap: Option<DatasetCap>,
    #[serde(default)]
    notes: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DatasetCap {
    amount: f64,
    period: String,
}

const CATEGORIES: &[&str] = &[
    "dining", "groceries", "gas", "travel", "transit", "drugstores", "streaming", "general",
];
const REWARD_TYPES: &[&str] = &["points", "miles", "cashback_percent"];
const NETWORKS: &[&str] = &["visa", "mastercard", "amex", "discover"];
const CAP_PERIODS: &[&str] = &["month", "quarter", "year"];

fn validate(ds: &Dataset) -> anyhow::Result<()> {
    let id_re = regex::Regex::new(r"^[a-z0-9-]+$")?;
    if ds.version.is_empty() {
        anyhow::bail!("version is required");
    }
    if ds.cards.is_empty() {
        anyhow::bail!("cards array must be non-empty");
    }
    for card in &ds.cards {
        if !id_re.is_match(&card.id) {
            anyhow::bail!("card {} id must be kebab-case", card.id);
        }
        if let Some(n) = &card.network {
            if !NETWORKS.contains(&n.as_str()) {
                anyhow::bail!("card {} invalid network {}", card.id, n);
            }
        }
        if let Some(af) = card.annual_fee {
            if af < 0 {
                anyhow::bail!("card {} negative annualFee", card.id);
            }
        }
        if card.reward_rules.is_empty() {
            anyhow::bail!("card {} must have >=1 reward rule", card.id);
        }
        for rule in &card.reward_rules {
            if !CATEGORIES.contains(&rule.category.as_str()) {
                anyhow::bail!("card {} unknown category {}", card.id, rule.category);
            }
            if !REWARD_TYPES.contains(&rule.reward_type.as_str()) {
                anyhow::bail!("card {} unknown rewardType {}", card.id, rule.reward_type);
            }
            if rule.rate <= 0.0 {
                anyhow::bail!("card {} non-positive rate", card.id);
            }
            if let Some(cap) = &rule.cap {
                if cap.amount <= 0.0 {
                    anyhow::bail!("card {} cap.amount must be positive", card.id);
                }
                if !CAP_PERIODS.contains(&cap.period.as_str()) {
                    anyhow::bail!("card {} unknown cap.period {}", card.id, cap.period);
                }
            }
        }
    }
    Ok(())
}

async fn load_dataset() -> anyhow::Result<Dataset> {
    if let Ok(url) = std::env::var("CARDS_DATA_URL") {
        println!("Fetching dataset from {}", url);
        let res = reqwest::get(&url).await?;
        if !res.status().is_success() {
            anyhow::bail!("Failed to fetch {}: HTTP {}", url, res.status());
        }
        let ds: Dataset = res.json().await?;
        validate(&ds)?;
        return Ok(ds);
    }

    let file: PathBuf = std::env::var("CARDS_DATA_FILE")
        .map(PathBuf::from)
        .unwrap_or_else(|_| std::env::current_dir().unwrap().join("db/cards-dataset.json"));
    println!("Loading dataset from {}", file.display());
    let raw = std::fs::read_to_string(&file)?;
    let ds: Dataset = serde_json::from_str(&raw)?;
    validate(&ds)?;
    Ok(ds)
}

#[derive(Default)]
struct Stats {
    cards_upserted: u64,
    rules_upserted: u64,
    rules_deleted: u64,
    cards_deleted: u64,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    let url = std::env::var("DATABASE_URL")
        .map_err(|_| anyhow::anyhow!("DATABASE_URL environment variable is required."))?;

    let prune = std::env::args().any(|a| a == "--prune")
        || std::env::var("CARDS_SYNC_PRUNE").ok().as_deref() == Some("true");

    let dataset = load_dataset().await?;
    println!(
        "Dataset version={} cards={}{}",
        dataset.version,
        dataset.cards.len(),
        if prune { " (prune mode: unknown cards will be deleted)" } else { "" }
    );
    let _ = dataset.source.as_ref();

    let pool = PgPoolOptions::new()
        .acquire_timeout(Duration::from_secs(10))
        .connect(&url)
        .await?;

    let mut stats = Stats::default();
    let mut tx = pool.begin().await?;

    for card in &dataset.cards {
        sqlx::query(
            "INSERT INTO cards (id, issuer, name, network, annual_fee)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (id) DO UPDATE SET
               issuer = EXCLUDED.issuer,
               name = EXCLUDED.name,
               network = EXCLUDED.network,
               annual_fee = EXCLUDED.annual_fee",
        )
        .bind(&card.id)
        .bind(&card.issuer)
        .bind(&card.name)
        .bind(card.network.as_deref())
        .bind(card.annual_fee)
        .execute(&mut *tx)
        .await?;
        stats.cards_upserted += 1;

        let keep: Vec<String> = card.reward_rules.iter().map(|r| r.category.clone()).collect();
        let del = sqlx::query("DELETE FROM reward_rules WHERE card_id = $1 AND category <> ALL($2::text[])")
            .bind(&card.id)
            .bind(&keep)
            .execute(&mut *tx)
            .await?;
        stats.rules_deleted += del.rows_affected();

        for rule in &card.reward_rules {
            let cap_amount = rule.cap.as_ref().map(|c| c.amount);
            let cap_period = rule.cap.as_ref().map(|c| c.period.clone());
            sqlx::query(
                "INSERT INTO reward_rules (card_id, category, rate, reward_type, cap_amount, cap_period, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT (card_id, category) DO UPDATE SET
                   rate = EXCLUDED.rate,
                   reward_type = EXCLUDED.reward_type,
                   cap_amount = EXCLUDED.cap_amount,
                   cap_period = EXCLUDED.cap_period,
                   notes = EXCLUDED.notes",
            )
            .bind(&card.id)
            .bind(&rule.category)
            .bind(rule.rate)
            .bind(&rule.reward_type)
            .bind(cap_amount)
            .bind(cap_period)
            .bind(rule.notes.as_deref())
            .execute(&mut *tx)
            .await?;
            stats.rules_upserted += 1;
        }
    }

    if prune {
        let keep: Vec<String> = dataset.cards.iter().map(|c| c.id.clone()).collect();
        let del = sqlx::query("DELETE FROM cards WHERE id <> ALL($1::text[])")
            .bind(&keep)
            .execute(&mut *tx)
            .await?;
        stats.cards_deleted = del.rows_affected();
    }

    tx.commit().await?;
    println!(
        "Sync complete. cardsUpserted={} rulesUpserted={} rulesDeleted={} cardsDeleted={}",
        stats.cards_upserted, stats.rules_upserted, stats.rules_deleted, stats.cards_deleted
    );
    Ok(())
}
