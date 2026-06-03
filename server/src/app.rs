use std::sync::Arc;
use std::time::Duration;

use axum::http::{HeaderName, HeaderValue, Method};
use axum::routing::get;
use axum::Router;
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::auth::JwtKeys;
use crate::config::Config;
use crate::routes::{catalog, location, owned_cards, preferences, recommend};
use crate::state::AppState;

pub async fn build_app(config: &Config) -> anyhow::Result<Router> {
    let pool = build_pool(&config.database_url, config.use_ssl).await?;
    let jwt = Arc::new(JwtKeys::new(&config.jwt_secret));
    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()?;

    let state = AppState { pool, jwt, http };

    let cors = build_cors(&config.cors_origins);

    let api = Router::new()
        .merge(crate::auth::routes::router())  // /auth/*
        .merge(catalog::router())
        .merge(location::router())
        .merge(recommend::router())
        .merge(owned_cards::router())
        .merge(preferences::router());

    let app = Router::new()
        .route("/health", get(|| async { axum::Json(serde_json::json!({"status":"ok"})) }))
        .nest("/api", api)
        .with_state(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    Ok(app)
}

async fn build_pool(url: &str, use_ssl: bool) -> anyhow::Result<sqlx::PgPool> {
    // SQLx negotiates SSL based on `sslmode` in the URL. If we need SSL and
    // the URL has no sslmode, append `sslmode=require`.
    let url_with_ssl = if use_ssl && !url.contains("sslmode=") {
        let sep = if url.contains('?') { '&' } else { '?' };
        format!("{}{}sslmode=require", url, sep)
    } else {
        url.to_string()
    };
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .acquire_timeout(Duration::from_secs(10))
        .connect(&url_with_ssl)
        .await?;
    Ok(pool)
}

fn build_cors(origins: &[String]) -> CorsLayer {
    let allow_any = origins.is_empty();
    let cors = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::DELETE,
            Method::PATCH,
            Method::OPTIONS,
        ])
        .allow_headers([
            HeaderName::from_static("content-type"),
            HeaderName::from_static("authorization"),
        ]);

    if allow_any {
        cors.allow_origin(AllowOrigin::mirror_request())
    } else {
        let mut values: Vec<HeaderValue> = Vec::new();
        for o in origins {
            if let Ok(v) = HeaderValue::from_str(o) {
                values.push(v);
            }
        }
        cors.allow_origin(AllowOrigin::list(values))
    }
}
