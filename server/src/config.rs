use std::env;

pub struct Config {
    pub port: u16,
    pub host: String,
    pub database_url: String,
    pub jwt_secret: String,
    pub cors_origins: Vec<String>,
    pub use_ssl: bool,
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let database_url = env::var("DATABASE_URL")
            .map_err(|_| anyhow::anyhow!("DATABASE_URL environment variable is required."))?;

        let jwt_secret = env::var("JWT_SECRET")
            .map_err(|_| anyhow::anyhow!("JWT_SECRET environment variable is required (min 16 characters)."))?;
        if jwt_secret.len() < 16 {
            anyhow::bail!("JWT_SECRET environment variable is required (min 16 characters).");
        }

        let port: u16 = env::var("PORT").ok().and_then(|s| s.parse().ok()).unwrap_or(3000);
        let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());

        let cors_origins = env::var("CORS_ORIGINS")
            .unwrap_or_default()
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect::<Vec<_>>();

        let use_ssl = env::var("PGSSL").ok().as_deref() == Some("true")
            || regex::Regex::new(r"(?i)\.rds\.amazonaws\.com(:|/|$)")
                .unwrap()
                .is_match(&database_url);

        Ok(Self {
            port,
            host,
            database_url,
            jwt_secret,
            cors_origins,
            use_ssl,
        })
    }
}
