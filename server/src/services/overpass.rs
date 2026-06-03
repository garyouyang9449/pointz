use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::domain::types::RewardCategory;

#[derive(Debug, Clone, Serialize)]
pub struct DetectedPlace {
    pub category: RewardCategory,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(rename = "distanceMeters")]
    pub distance_meters: i64,
    pub source: &'static str,
}

const OVERPASS_URL: &str = "https://overpass-api.de/api/interpreter";
const SEARCH_RADIUS_M: u32 = 75;
const OVERPASS_USER_AGENT: &str = "pointz/0.1 (+https://github.com/anomalyco/pointz)";

#[derive(Debug, Deserialize)]
struct OverpassResponse {
    elements: Vec<OverpassElement>,
}

#[derive(Debug, Deserialize)]
struct OverpassElement {
    lat: Option<f64>,
    lon: Option<f64>,
    center: Option<Center>,
    tags: Option<HashMap<String, String>>,
}

#[derive(Debug, Deserialize)]
struct Center {
    lat: f64,
    lon: f64,
}

struct TagRule {
    key: &'static str,
    value: &'static str,
    category: RewardCategory,
    kind: &'static str,
}

fn tag_rules() -> &'static [TagRule] {
    use RewardCategory::*;
    static RULES: &[TagRule] = &[
        TagRule { key: "shop", value: "supermarket", category: Groceries, kind: "supermarket" },
        TagRule { key: "shop", value: "grocery", category: Groceries, kind: "grocery store" },
        TagRule { key: "shop", value: "greengrocer", category: Groceries, kind: "grocery store" },
        TagRule { key: "shop", value: "convenience", category: Groceries, kind: "convenience store" },
        TagRule { key: "amenity", value: "pharmacy", category: Drugstores, kind: "pharmacy" },
        TagRule { key: "shop", value: "chemist", category: Drugstores, kind: "drugstore" },
        TagRule { key: "amenity", value: "fuel", category: Gas, kind: "gas station" },
        TagRule { key: "amenity", value: "restaurant", category: Dining, kind: "restaurant" },
        TagRule { key: "amenity", value: "fast_food", category: Dining, kind: "fast food" },
        TagRule { key: "amenity", value: "cafe", category: Dining, kind: "cafe" },
        TagRule { key: "amenity", value: "bar", category: Dining, kind: "bar" },
        TagRule { key: "amenity", value: "pub", category: Dining, kind: "pub" },
        TagRule { key: "amenity", value: "food_court", category: Dining, kind: "food court" },
        TagRule { key: "amenity", value: "ice_cream", category: Dining, kind: "ice cream shop" },
        TagRule { key: "tourism", value: "hotel", category: Travel, kind: "hotel" },
        TagRule { key: "tourism", value: "motel", category: Travel, kind: "motel" },
        TagRule { key: "tourism", value: "hostel", category: Travel, kind: "hostel" },
        TagRule { key: "tourism", value: "guest_house", category: Travel, kind: "guest house" },
        TagRule { key: "aeroway", value: "aerodrome", category: Travel, kind: "airport" },
        TagRule { key: "aeroway", value: "terminal", category: Travel, kind: "airport terminal" },
        TagRule { key: "amenity", value: "car_rental", category: Travel, kind: "car rental" },
        TagRule { key: "railway", value: "station", category: Transit, kind: "train station" },
        TagRule { key: "railway", value: "subway_entrance", category: Transit, kind: "subway" },
        TagRule { key: "highway", value: "bus_stop", category: Transit, kind: "bus stop" },
        TagRule { key: "amenity", value: "bus_station", category: Transit, kind: "bus station" },
        TagRule { key: "amenity", value: "taxi", category: Transit, kind: "taxi stand" },
        TagRule { key: "amenity", value: "parking", category: Transit, kind: "parking" },
        TagRule { key: "amenity", value: "ferry_terminal", category: Transit, kind: "ferry terminal" },
    ];
    RULES
}

fn build_query(lat: f64, lng: f64, radius: u32) -> String {
    let filters = [
        r#"node["shop"~"^(supermarket|grocery|greengrocer|convenience|chemist)$"]"#,
        r#"node["amenity"~"^(pharmacy|fuel|restaurant|fast_food|cafe|bar|pub|food_court|ice_cream|car_rental|bus_station|taxi|parking|ferry_terminal)$"]"#,
        r#"node["tourism"~"^(hotel|motel|hostel|guest_house)$"]"#,
        r#"node["aeroway"~"^(aerodrome|terminal)$"]"#,
        r#"node["railway"~"^(station|subway_entrance)$"]"#,
        r#"node["highway"="bus_stop"]"#,
    ];

    let around_parts: String = filters
        .iter()
        .map(|f| format!("{}(around:{},{},{});", f, radius, lat, lng))
        .collect::<Vec<_>>()
        .join("\n  ");

    let way_parts: String = filters
        .iter()
        .map(|f| {
            let way = f.replacen("node", "way", 1);
            format!("{}(around:{},{},{});", way, radius, lat, lng)
        })
        .collect::<Vec<_>>()
        .join("\n  ");

    format!(
        "[out:json][timeout:10];\n(\n  {}\n  {}\n);\nout tags center 25;",
        around_parts, way_parts
    )
}

fn haversine(lat1: f64, lng1: f64, lat2: f64, lng2: f64) -> f64 {
    let r = 6371000.0_f64;
    let to_rad = |d: f64| d * std::f64::consts::PI / 180.0;
    let d_lat = to_rad(lat2 - lat1);
    let d_lng = to_rad(lng2 - lng1);
    let a = (d_lat / 2.0).sin().powi(2)
        + to_rad(lat1).cos() * to_rad(lat2).cos() * (d_lng / 2.0).sin().powi(2);
    2.0 * r * a.sqrt().asin()
}

fn classify(tags: &HashMap<String, String>) -> Option<(RewardCategory, &'static str)> {
    for rule in tag_rules() {
        if tags.get(rule.key).map(|v| v.as_str()) == Some(rule.value) {
            return Some((rule.category, rule.kind));
        }
    }
    None
}

pub async fn detect_category_from_location(
    client: &reqwest::Client,
    lat: f64,
    lng: f64,
) -> DetectedPlace {
    let radius = SEARCH_RADIUS_M;
    let query = build_query(lat, lng, radius);
    tracing::info!(lat, lng, radius, url = OVERPASS_URL, "overpass request");

    let body = format!("data={}", urlencoding::encode(&query));
    let req = client
        .post(OVERPASS_URL)
        .header("Content-Type", "application/x-www-form-urlencoded")
        .header("Accept", "application/json")
        .header("User-Agent", OVERPASS_USER_AGENT)
        .body(body)
        .send()
        .await;

    let res = match req {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = ?e, "overpass request failed");
            return fallback("unknown location");
        }
    };

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_else(|_| "<unreadable>".into());
        tracing::error!(%status, body, "overpass non-2xx");
        return fallback("unknown location");
    }

    let data: OverpassResponse = match res.json().await {
        Ok(d) => d,
        Err(e) => {
            tracing::error!(error = ?e, "overpass json parse failed");
            return fallback("unknown location");
        }
    };

    let mut best: Option<DetectedPlace> = None;
    for el in data.elements {
        let tags = match &el.tags {
            Some(t) => t,
            None => continue,
        };
        let (category, kind) = match classify(tags) {
            Some(v) => v,
            None => continue,
        };
        let el_lat = el.lat.or(el.center.as_ref().map(|c| c.lat));
        let el_lng = el.lon.or(el.center.as_ref().map(|c| c.lon));
        let (el_lat, el_lng) = match (el_lat, el_lng) {
            (Some(a), Some(b)) => (a, b),
            _ => continue,
        };
        let distance = haversine(lat, lng, el_lat, el_lng);
        let name = tags.get("name").cloned();
        let candidate = DetectedPlace {
            category,
            name,
            kind: kind.to_string(),
            distance_meters: distance.round() as i64,
            source: "overpass",
        };
        match &best {
            None => best = Some(candidate),
            Some(b) if candidate.distance_meters < b.distance_meters => best = Some(candidate),
            _ => {}
        }
    }

    best.unwrap_or_else(|| fallback("no nearby merchant"))
}

fn fallback(kind: &str) -> DetectedPlace {
    DetectedPlace {
        category: RewardCategory::General,
        name: None,
        kind: kind.to_string(),
        distance_meters: 0,
        source: "fallback",
    }
}
