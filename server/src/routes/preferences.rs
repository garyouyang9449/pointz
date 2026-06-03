use axum::extract::State;
use axum::routing::patch;
use axum::{Json, Router};
use serde_json::{json, Value};
use sqlx::types::Json as SqlxJson;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

const ALLOWED_KEYS: &[&str] = &["locationConsent"];

async fn patch_prefs(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<Value>,
) -> AppResult<Json<Value>> {
    let user_uuid = Uuid::parse_str(&user.id).map_err(|_| AppError::unauthorized())?;

    let obj = body.as_object().ok_or_else(|| {
        AppError::bad_request("Invalid preferences update.").with_details(json!({
            "fieldErrors": { "_root": ["Body must be an object"] }
        }))
    })?;

    // strict: reject unknown keys
    let mut field_errors: serde_json::Map<String, Value> = serde_json::Map::new();
    for k in obj.keys() {
        if !ALLOWED_KEYS.contains(&k.as_str()) {
            field_errors.insert(k.clone(), json!(["Unrecognized key"]));
        }
    }
    if !field_errors.is_empty() {
        return Err(AppError::bad_request("Invalid preferences update.").with_details(json!({
            "fieldErrors": Value::Object(field_errors)
        })));
    }

    let mut patch_map = serde_json::Map::new();
    if let Some(v) = obj.get("locationConsent") {
        let s = v.as_str().unwrap_or("");
        if s != "granted" && s != "denied" {
            return Err(AppError::bad_request("Invalid preferences update.").with_details(json!({
                "fieldErrors": { "locationConsent": ["Must be 'granted' or 'denied'"] }
            })));
        }
        patch_map.insert("locationConsent".into(), Value::String(s.into()));
    }

    if patch_map.is_empty() {
        let row: Option<(SqlxJson<Value>,)> =
            sqlx::query_as("SELECT preferences FROM users WHERE id = $1 LIMIT 1")
                .bind(user_uuid)
                .fetch_optional(&state.pool)
                .await?;
        let prefs = row
            .ok_or_else(|| AppError::not_found("User not found."))?
            .0
             .0;
        return Ok(Json(json!({ "preferences": prefs })));
    }

    let patch_val = Value::Object(patch_map);
    let row: Option<(SqlxJson<Value>,)> = sqlx::query_as(
        "UPDATE users SET preferences = preferences || $1::jsonb WHERE id = $2 RETURNING preferences",
    )
    .bind(SqlxJson(patch_val))
    .bind(user_uuid)
    .fetch_optional(&state.pool)
    .await?;

    let prefs = row
        .ok_or_else(|| AppError::not_found("User not found."))?
        .0
         .0;
    Ok(Json(json!({ "preferences": prefs })))
}

pub fn router() -> Router<AppState> {
    Router::new().route("/me/preferences", patch(patch_prefs))
}
