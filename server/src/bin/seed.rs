use sqlx::postgres::PgPoolOptions;
use std::path::PathBuf;
use std::time::Duration;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    let url = std::env::var("DATABASE_URL")
        .map_err(|_| anyhow::anyhow!("DATABASE_URL environment variable is required."))?;

    let path: PathBuf = std::env::current_dir()?.join("db/init.sql");
    println!("Seeding catalog from {}...", path.display());
    let sql = std::fs::read_to_string(&path)?;

    let pool = PgPoolOptions::new()
        .acquire_timeout(Duration::from_secs(10))
        .connect(&url)
        .await?;

    let mut tx = pool.begin().await?;
    sqlx::raw_sql(&sql).execute(&mut *tx).await?;
    tx.commit().await?;

    let row: (i64, i64) = sqlx::query_as(
        "SELECT (SELECT COUNT(*) FROM cards), (SELECT COUNT(*) FROM reward_rules)",
    )
    .fetch_one(&pool)
    .await?;
    println!("Seed complete. cards={} reward_rules={}", row.0, row.1);
    Ok(())
}
