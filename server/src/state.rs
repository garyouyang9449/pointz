use std::sync::Arc;

use sqlx::PgPool;

use crate::auth::JwtKeys;

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub jwt: Arc<JwtKeys>,
    pub http: reqwest::Client,
}
