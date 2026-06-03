use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize)]
pub struct IpLocation {
    pub lat: f64,
    pub lng: f64,
    pub accuracy: &'static str,
}

#[derive(Debug, Deserialize)]
struct IpWhoResponse {
    success: Option<bool>,
    latitude: Option<f64>,
    longitude: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct GeoJsResponse {
    latitude: Option<String>,
    longitude: Option<String>,
}

#[derive(Debug, Deserialize)]
struct IpApiCoResponse {
    latitude: Option<f64>,
    longitude: Option<f64>,
    error: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct IpInfoResponse {
    loc: Option<String>,
}

pub async fn detect_location_from_ip(
    client: &reqwest::Client,
    ip: Option<&str>,
) -> Result<IpLocation, String> {
    let public_ip = get_public_ip(ip);
    let urls: Vec<String> = if let Some(ip) = &public_ip {
        let enc = urlencoding::encode(ip);
        vec![
            format!("https://get.geojs.io/v1/ip/geo/{}.json", enc),
            format!("https://ipinfo.io/{}/json", enc),
            format!("https://ipapi.co/{}/json/", enc),
            format!("https://ipwho.is/{}", enc),
        ]
    } else {
        vec![
            "https://get.geojs.io/v1/ip/geo.json".into(),
            "https://ipinfo.io/json".into(),
            "https://ipapi.co/json/".into(),
            "https://ipwho.is/".into(),
        ]
    };

    for url in urls {
        match fetch_location(client, &url).await {
            Ok(Some(loc)) => return Ok(loc),
            _ => continue,
        }
    }
    Err("Unable to determine location from IP address.".into())
}

async fn fetch_location(
    client: &reqwest::Client,
    url: &str,
) -> Result<Option<IpLocation>, reqwest::Error> {
    if url.contains("get.geojs.io") {
        let res = client.get(url).send().await?;
        if !res.status().is_success() {
            return Ok(None);
        }
        let data: GeoJsResponse = res.json().await?;
        return Ok(to_location(
            data.latitude.as_deref().and_then(|s| s.parse().ok()),
            data.longitude.as_deref().and_then(|s| s.parse().ok()),
        ));
    }
    if url.contains("ipinfo.io") {
        let res = client.get(url).send().await?;
        if !res.status().is_success() {
            return Ok(None);
        }
        let data: IpInfoResponse = res.json().await?;
        let (lat, lng) = match data.loc {
            Some(s) => {
                let parts: Vec<&str> = s.split(',').collect();
                (
                    parts.first().and_then(|v| v.parse().ok()),
                    parts.get(1).and_then(|v| v.parse().ok()),
                )
            }
            None => (None, None),
        };
        return Ok(to_location(lat, lng));
    }
    if url.contains("ipapi.co") {
        let res = client.get(url).send().await?;
        if !res.status().is_success() {
            return Ok(None);
        }
        let data: IpApiCoResponse = res.json().await?;
        if data.error.unwrap_or(false) {
            return Ok(None);
        }
        return Ok(to_location(data.latitude, data.longitude));
    }

    let res = client.get(url).send().await?;
    if !res.status().is_success() {
        return Ok(None);
    }
    let data: IpWhoResponse = res.json().await?;
    if data.success == Some(false) {
        return Ok(None);
    }
    Ok(to_location(data.latitude, data.longitude))
}

fn to_location(lat: Option<f64>, lng: Option<f64>) -> Option<IpLocation> {
    let lat = lat?;
    let lng = lng?;
    if !lat.is_finite() || !lng.is_finite() || !(-90.0..=90.0).contains(&lat) || !(-180.0..=180.0).contains(&lng) {
        return None;
    }
    Some(IpLocation { lat, lng, accuracy: "ip" })
}

fn get_public_ip(ip: Option<&str>) -> Option<String> {
    let ip = ip?;
    let first = ip.split(',').next()?.trim().trim_start_matches("::ffff:");
    if first.is_empty() || is_private_ip(first) {
        return None;
    }
    Some(first.to_string())
}

fn is_private_ip(ip: &str) -> bool {
    if ip == "127.0.0.1" || ip == "::1" {
        return true;
    }
    if ip.starts_with("10.") || ip.starts_with("192.168.") {
        return true;
    }
    if ip.starts_with("fc") || ip.starts_with("fd") || ip.starts_with("fe80:") {
        return true;
    }
    // 172.16.0.0/12: 172.16.x.x - 172.31.x.x
    if let Some(rest) = ip.strip_prefix("172.") {
        if let Some(second) = rest.split('.').next() {
            if let Ok(n) = second.parse::<u32>() {
                if (16..=31).contains(&n) {
                    return true;
                }
            }
        }
    }
    false
}
