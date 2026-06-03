use axum::extract::State;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::types::Json as SqlxJson;
use uuid::Uuid;

use crate::auth::{hash_password, issue_token, verify_password, AuthUser};
use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct Credentials {
    #[serde(default)]
    email: Option<String>,
    #[serde(default)]
    password: Option<String>,
}

#[derive(Debug, Serialize)]
struct UserView {
    id: String,
    email: String,
    preferences: Value,
}

#[derive(Debug, Serialize)]
struct AuthResponse {
    token: String,
    user: UserView,
}

fn normalize_email(s: &str) -> String {
    s.trim().to_lowercase()
}

fn validate_credentials(body: &Credentials, label: &str) -> Result<(String, String), AppError> {
    let mut errors: serde_json::Map<String, Value> = serde_json::Map::new();
    let mut form_errors: Vec<String> = Vec::new();

    let email = body.email.clone().unwrap_or_default();
    let password = body.password.clone().unwrap_or_default();

    if email.is_empty() {
        errors.insert("email".into(), json!(["Required"]));
    } else if !is_valid_email(&email) || email.len() > 254 {
        errors.insert("email".into(), json!(["Invalid email"]));
    }

    if password.is_empty() {
        errors.insert("password".into(), json!(["Required"]));
    } else if password.len() < 8 || password.len() > 200 {
        errors.insert(
            "password".into(),
            json!(["String must contain at least 8 character(s)"]),
        );
    }

    if errors.is_empty() && form_errors.is_empty() {
        return Ok((email, password));
    }

    let _ = label;
    Err(AppError::bad_request(format!(
        "Invalid {} request.",
        label
    ))
    .with_details(json!({
        "formErrors": form_errors,
        "fieldErrors": Value::Object(errors)
    })))
}

fn is_valid_email(s: &str) -> bool {
    // Lightweight RFC-5322 subset: requires `local@domain.tld`.
    let parts: Vec<&str> = s.split('@').collect();
    if parts.len() != 2 {
        return false;
    }
    let (local, domain) = (parts[0], parts[1]);
    if local.is_empty() || domain.is_empty() || !domain.contains('.') {
        return false;
    }
    !s.chars().any(|c| c.is_whitespace())
}

const DEFAULT_PREFERENCES: &str = r#"{"locationConsent":"granted"}"#;

async fn signup(
    State(state): State<AppState>,
    Json(body): Json<Credentials>,
) -> AppResult<(axum::http::StatusCode, Json<AuthResponse>)> {
    let (raw_email, password) = validate_credentials(&body, "signup")?;
    let email = normalize_email(&raw_email);

    let existing: Option<(Uuid,)> =
        sqlx::query_as("SELECT id FROM users WHERE email = $1 LIMIT 1")
            .bind(&email)
            .fetch_optional(&state.pool)
            .await?;

    if existing.is_some() {
        return Err(AppError::conflict(
            "An account with that email already exists.",
        ));
    }

    let password_hash = hash_password(&password)?;
    let default_prefs: Value = serde_json::from_str(DEFAULT_PREFERENCES).unwrap();

    let row: (Uuid, String, SqlxJson<Value>) = sqlx::query_as(
        "INSERT INTO users (email, password_hash, preferences)
         VALUES ($1, $2, $3)
         RETURNING id, email, preferences",
    )
    .bind(&email)
    .bind(&password_hash)
    .bind(SqlxJson(default_prefs))
    .fetch_one(&state.pool)
    .await?;

    let id_str = row.0.to_string();
    let token = issue_token(&state.jwt, &id_str, &row.1)?;

    Ok((
        axum::http::StatusCode::CREATED,
        Json(AuthResponse {
            token,
            user: UserView { id: id_str, email: row.1, preferences: row.2 .0 },
        }),
    ))
}

async fn login(
    State(state): State<AppState>,
    Json(body): Json<Credentials>,
) -> AppResult<Json<AuthResponse>> {
    let (raw_email, password) = validate_credentials(&body, "login")?;
    let email = normalize_email(&raw_email);

    let row: Option<(Uuid, String, String, SqlxJson<Value>)> = sqlx::query_as(
        "SELECT id, email, password_hash, preferences FROM users WHERE email = $1 LIMIT 1",
    )
    .bind(&email)
    .fetch_optional(&state.pool)
    .await?;

    let row = row.ok_or_else(|| {
        AppError::new(axum::http::StatusCode::UNAUTHORIZED, "Invalid email or password.")
    })?;

    if !verify_password(&password, &row.2) {
        return Err(AppError::new(
            axum::http::StatusCode::UNAUTHORIZED,
            "Invalid email or password.",
        ));
    }

    let id_str = row.0.to_string();
    let token = issue_token(&state.jwt, &id_str, &row.1)?;
    Ok(Json(AuthResponse {
        token,
        user: UserView { id: id_str, email: row.1, preferences: row.3 .0 },
    }))
}

#[derive(Debug, Serialize)]
struct MeResponse {
    user: UserView,
}

async fn me(State(state): State<AppState>, user: AuthUser) -> AppResult<Json<MeResponse>> {
    let user_uuid = Uuid::parse_str(&user.id).map_err(|_| AppError::unauthorized())?;

    let row: Option<(Uuid, String, SqlxJson<Value>)> =
        sqlx::query_as("SELECT id, email, preferences FROM users WHERE id = $1 LIMIT 1")
            .bind(user_uuid)
            .fetch_optional(&state.pool)
            .await?;

    let row = row.ok_or_else(|| AppError::not_found("User not found."))?;
    Ok(Json(MeResponse {
        user: UserView { id: row.0.to_string(), email: row.1, preferences: row.2 .0 },
    }))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/auth/signup", post(signup))
        .route("/auth/login", post(login))
        .route("/auth/me", get(me))
}
