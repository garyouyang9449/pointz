use std::sync::Arc;

pub mod routes;

use axum::async_trait;
use axum::extract::{FromRef, FromRequestParts};
use axum::http::request::Parts;
use bcrypt::{hash, verify, DEFAULT_COST};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::state::AppState;

const BCRYPT_ROUNDS: u32 = 12;
// jsonwebtoken validates exp as Unix seconds (i64).
const TOKEN_EXPIRY_SECS: i64 = 60 * 60 * 24 * 7; // 7 days

pub struct JwtKeys {
    pub encoding: EncodingKey,
    pub decoding: DecodingKey,
}

impl JwtKeys {
    pub fn new(secret: &str) -> Self {
        Self {
            encoding: EncodingKey::from_secret(secret.as_bytes()),
            decoding: DecodingKey::from_secret(secret.as_bytes()),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TokenClaims {
    pub sub: String,
    pub email: String,
    pub exp: i64,
    pub iat: i64,
}

pub fn hash_password(plain: &str) -> Result<String, AppError> {
    let _ = DEFAULT_COST; // suppress unused import warning
    hash(plain, BCRYPT_ROUNDS).map_err(|e| {
        tracing::error!(error = ?e, "bcrypt hash error");
        AppError::internal("Failed to hash password")
    })
}

pub fn verify_password(plain: &str, hashed: &str) -> bool {
    verify(plain, hashed).unwrap_or(false)
}

pub fn issue_token(keys: &JwtKeys, user_id: &str, email: &str) -> Result<String, AppError> {
    let now = Utc::now();
    let claims = TokenClaims {
        sub: user_id.to_string(),
        email: email.to_string(),
        iat: now.timestamp(),
        exp: (now + Duration::seconds(TOKEN_EXPIRY_SECS)).timestamp(),
    };
    encode(&Header::new(Algorithm::HS256), &claims, &keys.encoding)
        .map_err(|e| {
            tracing::error!(error = ?e, "jwt encode error");
            AppError::internal("Failed to issue token")
        })
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub id: String,
    pub email: String,
}

#[async_trait]
impl<S> FromRequestParts<S> for AuthUser
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = AppState::from_ref(state);
        extract_user(parts, &app_state.jwt).await
    }
}

async fn extract_user(parts: &mut Parts, keys: &Arc<JwtKeys>) -> Result<AuthUser, AppError> {
    let header = parts
        .headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .ok_or_else(AppError::unauthorized)?;

    let token = header
        .strip_prefix("Bearer ")
        .or_else(|| header.strip_prefix("bearer "))
        .ok_or_else(AppError::unauthorized)?;

    let mut validation = Validation::new(Algorithm::HS256);
    validation.set_required_spec_claims(&["exp"]);
    let data = decode::<TokenClaims>(token, &keys.decoding, &validation).map_err(|e| {
        tracing::warn!(error = ?e, "JWT verification failed");
        AppError::unauthorized()
    })?;

    if data.claims.sub.is_empty() || data.claims.email.is_empty() {
        return Err(AppError::unauthorized());
    }

    Ok(AuthUser { id: data.claims.sub, email: data.claims.email })
}
