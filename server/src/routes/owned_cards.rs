use axum::extract::{Path, State};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashSet;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{AppError, AppResult};
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct SetOwnedBody {
    #[serde(rename = "cardIds")]
    card_ids: Option<Vec<String>>,
}

async fn assert_cards_exist(state: &AppState, ids: &[String]) -> AppResult<()> {
    if ids.is_empty() {
        return Ok(());
    }
    let rows: Vec<(String,)> = sqlx::query_as("SELECT id FROM cards WHERE id = ANY($1)")
        .bind(ids)
        .fetch_all(&state.pool)
        .await?;
    let found: HashSet<String> = rows.into_iter().map(|(id,)| id).collect();
    let unique: HashSet<&String> = ids.iter().collect();
    if found.len() != unique.len() {
        let missing: Vec<&String> = ids.iter().filter(|i| !found.contains(*i)).collect();
        return Err(AppError::bad_request(format!(
            "Unknown card id(s): {}",
            missing
                .iter()
                .map(|s| s.as_str())
                .collect::<Vec<_>>()
                .join(", ")
        )));
    }
    Ok(())
}

async fn get_user_card_ids(state: &AppState, user_id: Uuid) -> AppResult<Vec<String>> {
    let rows: Vec<(String,)> =
        sqlx::query_as("SELECT card_id FROM user_owned_cards WHERE user_id = $1")
            .bind(user_id)
            .fetch_all(&state.pool)
            .await?;
    Ok(rows.into_iter().map(|(id,)| id).collect())
}

fn parse_user(user: &AuthUser) -> AppResult<Uuid> {
    Uuid::parse_str(&user.id).map_err(|_| AppError::unauthorized())
}

async fn list(State(state): State<AppState>, user: AuthUser) -> AppResult<Json<Value>> {
    let uid = parse_user(&user)?;
    let ids = get_user_card_ids(&state, uid).await?;
    Ok(Json(json!({ "cardIds": ids })))
}

async fn replace_set(
    State(state): State<AppState>,
    user: AuthUser,
    Json(body): Json<SetOwnedBody>,
) -> AppResult<Json<Value>> {
    let card_ids = body.card_ids.ok_or_else(|| {
        AppError::bad_request("Invalid request.").with_details(json!({
            "fieldErrors": { "cardIds": ["Required"] }
        }))
    })?;
    if card_ids.len() > 100 {
        return Err(AppError::bad_request("Invalid request.").with_details(json!({
            "fieldErrors": { "cardIds": ["Maximum 100 cards"] }
        })));
    }

    let uid = parse_user(&user)?;
    let dedup: Vec<String> = {
        let mut seen = HashSet::new();
        card_ids
            .into_iter()
            .filter(|s| seen.insert(s.clone()))
            .collect()
    };

    assert_cards_exist(&state, &dedup).await?;

    let mut tx = state.pool.begin().await?;
    sqlx::query("DELETE FROM user_owned_cards WHERE user_id = $1")
        .bind(uid)
        .execute(&mut *tx)
        .await?;
    if !dedup.is_empty() {
        // bulk insert via UNNEST
        let user_ids: Vec<Uuid> = std::iter::repeat(uid).take(dedup.len()).collect();
        sqlx::query(
            "INSERT INTO user_owned_cards (user_id, card_id)
             SELECT * FROM UNNEST($1::uuid[], $2::text[])",
        )
        .bind(&user_ids)
        .bind(&dedup)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;

    Ok(Json(json!({ "cardIds": dedup })))
}

async fn add_one(
    State(state): State<AppState>,
    user: AuthUser,
    Path(card_id): Path<String>,
) -> AppResult<Json<Value>> {
    if card_id.is_empty() {
        return Err(AppError::bad_request("Invalid card id."));
    }
    let uid = parse_user(&user)?;
    assert_cards_exist(&state, &[card_id.clone()]).await?;
    sqlx::query(
        "INSERT INTO user_owned_cards (user_id, card_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING",
    )
    .bind(uid)
    .bind(&card_id)
    .execute(&state.pool)
    .await?;
    let ids = get_user_card_ids(&state, uid).await?;
    Ok(Json(json!({ "cardIds": ids })))
}

async fn remove_one(
    State(state): State<AppState>,
    user: AuthUser,
    Path(card_id): Path<String>,
) -> AppResult<Json<Value>> {
    if card_id.is_empty() {
        return Err(AppError::bad_request("Invalid card id."));
    }
    let uid = parse_user(&user)?;
    sqlx::query("DELETE FROM user_owned_cards WHERE user_id = $1 AND card_id = $2")
        .bind(uid)
        .bind(&card_id)
        .execute(&state.pool)
        .await?;
    let ids = get_user_card_ids(&state, uid).await?;
    Ok(Json(json!({ "cardIds": ids })))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/me/owned-cards", get(list).put(replace_set))
        .route("/me/owned-cards/:cardId", post(add_one).delete(remove_one))
}
