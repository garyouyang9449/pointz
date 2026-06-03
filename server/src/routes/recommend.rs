use axum::extract::State;
use axum::routing::post;
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::domain::types::RewardCategory;
use crate::error::{AppError, AppResult};
use crate::services::overpass::detect_category_from_location;
use crate::services::recommend::recommend_card;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct RecommendBody {
    #[serde(rename = "ownedCardIds")]
    owned_card_ids: Option<Vec<String>>,
    category: Option<String>,
    amount: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct RecommendByLocationBody {
    #[serde(rename = "ownedCardIds")]
    owned_card_ids: Option<Vec<String>>,
    lat: Option<f64>,
    lng: Option<f64>,
    amount: Option<f64>,
}

fn validate_amount(amount: Option<f64>) -> Result<Option<f64>, &'static str> {
    if let Some(a) = amount {
        if !a.is_finite() || a <= 0.0 {
            return Err("amount must be a positive finite number");
        }
    }
    Ok(amount)
}

async fn recommend(
    State(state): State<AppState>,
    Json(body): Json<RecommendBody>,
) -> AppResult<Json<Value>> {
    let mut field_errors: serde_json::Map<String, Value> = serde_json::Map::new();

    let owned = body.owned_card_ids.unwrap_or_default();
    if owned.is_empty() || owned.iter().any(|s| s.is_empty()) {
        field_errors.insert("ownedCardIds".into(), json!(["Required, non-empty"]));
    }

    let category_str = body.category.unwrap_or_default();
    let category = RewardCategory::from_str(&category_str);
    if category.is_none() {
        field_errors.insert("category".into(), json!(["Invalid category"]));
    }

    let amount = match validate_amount(body.amount) {
        Ok(v) => v,
        Err(e) => {
            field_errors.insert("amount".into(), json!([e]));
            None
        }
    };

    if !field_errors.is_empty() {
        return Err(AppError::bad_request("Invalid recommendation request.").with_details(json!({
            "formErrors": [],
            "fieldErrors": Value::Object(field_errors),
        })));
    }

    let result = recommend_card(&state.pool, &owned, category.unwrap(), amount).await?;
    Ok(Json(serde_json::to_value(result).unwrap()))
}

async fn recommend_by_location(
    State(state): State<AppState>,
    Json(body): Json<RecommendByLocationBody>,
) -> AppResult<Json<Value>> {
    let mut field_errors: serde_json::Map<String, Value> = serde_json::Map::new();

    let owned = body.owned_card_ids.unwrap_or_default();
    if owned.is_empty() || owned.iter().any(|s| s.is_empty()) {
        field_errors.insert("ownedCardIds".into(), json!(["Required, non-empty"]));
    }

    let lat = body.lat;
    let lng = body.lng;
    match lat {
        Some(v) if (-90.0..=90.0).contains(&v) && v.is_finite() => {}
        _ => {
            field_errors.insert("lat".into(), json!(["Number between -90 and 90 required"]));
        }
    }
    match lng {
        Some(v) if (-180.0..=180.0).contains(&v) && v.is_finite() => {}
        _ => {
            field_errors.insert("lng".into(), json!(["Number between -180 and 180 required"]));
        }
    }
    let amount = match validate_amount(body.amount) {
        Ok(v) => v,
        Err(e) => {
            field_errors.insert("amount".into(), json!([e]));
            None
        }
    };

    if !field_errors.is_empty() {
        return Err(AppError::bad_request("Invalid location recommendation request.")
            .with_details(json!({
                "formErrors": [],
                "fieldErrors": Value::Object(field_errors),
            })));
    }

    let lat = lat.unwrap();
    let lng = lng.unwrap();
    let place = detect_category_from_location(&state.http, lat, lng).await;
    let recommendation = recommend_card(&state.pool, &owned, place.category, amount).await?;
    let mut value = serde_json::to_value(recommendation).unwrap();
    value["place"] = serde_json::to_value(place).unwrap();
    Ok(Json(value))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/recommend", post(recommend))
        .route("/recommend-by-location", post(recommend_by_location))
}
