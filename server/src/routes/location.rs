use axum::extract::{ConnectInfo, State};
use axum::http::HeaderMap;
use axum::routing::get;
use axum::{Json, Router};
use serde_json::{json, Value};
use std::net::SocketAddr;

use crate::error::{AppError, AppResult};
use crate::services::ip_location::detect_location_from_ip;
use crate::state::AppState;

async fn location(
    State(state): State<AppState>,
    headers: HeaderMap,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> AppResult<Json<Value>> {
    let xff = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let ip = xff.unwrap_or_else(|| addr.ip().to_string());

    match detect_location_from_ip(&state.http, Some(&ip)).await {
        Ok(loc) => Ok(Json(serde_json::to_value(loc).unwrap())),
        Err(message) => Err(AppError::new(
            axum::http::StatusCode::SERVICE_UNAVAILABLE,
            message,
        )),
    }
    .map(|v| {
        // ensure object form for axum
        let _ = json!({});
        v
    })
}

pub fn router() -> Router<AppState> {
    Router::new().route("/location", get(location))
}
