use sqlx::postgres::PgPoolOptions;
use std::time::Duration;

/// Idempotent schema setup. Replaces the old drizzle migrations.
/// Safe to re-run on a populated DB.
const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS cards (
    id          TEXT PRIMARY KEY,
    issuer      TEXT NOT NULL,
    name        TEXT NOT NULL,
    network     TEXT,
    annual_fee  INTEGER
);

CREATE TABLE IF NOT EXISTS reward_rules (
    id           BIGSERIAL PRIMARY KEY,
    card_id      TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    category     TEXT NOT NULL,
    rate         NUMERIC NOT NULL,
    reward_type  TEXT NOT NULL,
    cap_amount   NUMERIC,
    cap_period   TEXT,
    notes        TEXT
);

CREATE INDEX IF NOT EXISTS reward_rules_card_id_idx ON reward_rules (card_id);
CREATE INDEX IF NOT EXISTS reward_rules_category_idx ON reward_rules (category);

DO $$ BEGIN
    ALTER TABLE reward_rules
      ADD CONSTRAINT reward_rules_card_id_category_unique UNIQUE (card_id, category);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    preferences   JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 0002: ensure preferences column exists on already-migrated DBs.
DO $$ BEGIN
    ALTER TABLE users ADD COLUMN preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_owned_cards (
    user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id  TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, card_id)
);
"#;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    let url = std::env::var("DATABASE_URL")
        .map_err(|_| anyhow::anyhow!("DATABASE_URL environment variable is required."))?;

    println!("Running schema setup...");
    let pool = PgPoolOptions::new()
        .acquire_timeout(Duration::from_secs(10))
        .connect(&url)
        .await?;

    let mut tx = pool.begin().await?;
    sqlx::raw_sql(SCHEMA_SQL).execute(&mut *tx).await?;
    tx.commit().await?;
    println!("Schema setup complete.");
    Ok(())
}
