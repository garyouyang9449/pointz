use axum::extract::State;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};

use crate::data::cards::get_cards;
use crate::domain::categories::categories;
use crate::error::AppResult;
use crate::state::AppState;

async fn list_cards(State(state): State<AppState>) -> AppResult<Json<Value>> {
    let cards = get_cards(&state.pool).await?;
    Ok(Json(json!({ "cards": cards })))
}

async fn list_categories() -> Json<Value> {
    Json(json!({ "categories": categories() }))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/cards", get(list_cards))
        .route("/categories", get(list_categories))
}
