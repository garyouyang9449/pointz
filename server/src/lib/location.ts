import type { RewardCategory } from "../types.js";

export interface DetectedPlace {
  category: RewardCategory;
  name?: string;
  type: string; // human-readable place type, e.g. "supermarket"
  distanceMeters: number;
  source: "overpass" | "fallback";
}

interface OverpassElement {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const SEARCH_RADIUS_M = 75; // tight radius — user is "at" the place

// Map OSM tag values -> our reward categories.
// Order matters; earlier entries win when multiple tags match.
const TAG_RULES: Array<{
  key: string;
  value: string;
  category: RewardCategory;
  type: string;
}> = [
  // Groceries
  { key: "shop", value: "supermarket", category: "groceries", type: "supermarket" },
  { key: "shop", value: "grocery", category: "groceries", type: "grocery store" },
  { key: "shop", value: "greengrocer", category: "groceries", type: "grocery store" },
  { key: "shop", value: "convenience", category: "groceries", type: "convenience store" },

  // Drugstores
  { key: "amenity", value: "pharmacy", category: "drugstores", type: "pharmacy" },
  { key: "shop", value: "chemist", category: "drugstores", type: "drugstore" },

  // Gas
  { key: "amenity", value: "fuel", category: "gas", type: "gas station" },

  // Dining
  { key: "amenity", value: "restaurant", category: "dining", type: "restaurant" },
  { key: "amenity", value: "fast_food", category: "dining", type: "fast food" },
  { key: "amenity", value: "cafe", category: "dining", type: "cafe" },
  { key: "amenity", value: "bar", category: "dining", type: "bar" },
  { key: "amenity", value: "pub", category: "dining", type: "pub" },
  { key: "amenity", value: "food_court", category: "dining", type: "food court" },
  { key: "amenity", value: "ice_cream", category: "dining", type: "ice cream shop" },

  // Travel
  { key: "tourism", value: "hotel", category: "travel", type: "hotel" },
  { key: "tourism", value: "motel", category: "travel", type: "motel" },
  { key: "tourism", value: "hostel", category: "travel", type: "hostel" },
  { key: "tourism", value: "guest_house", category: "travel", type: "guest house" },
  { key: "aeroway", value: "aerodrome", category: "travel", type: "airport" },
  { key: "aeroway", value: "terminal", category: "travel", type: "airport terminal" },
  { key: "amenity", value: "car_rental", category: "travel", type: "car rental" },

  // Transit
  { key: "railway", value: "station", category: "transit", type: "train station" },
  { key: "railway", value: "subway_entrance", category: "transit", type: "subway" },
  { key: "highway", value: "bus_stop", category: "transit", type: "bus stop" },
  { key: "amenity", value: "bus_station", category: "transit", type: "bus station" },
  { key: "amenity", value: "taxi", category: "transit", type: "taxi stand" },
  { key: "amenity", value: "parking", category: "transit", type: "parking" },
  { key: "amenity", value: "ferry_terminal", category: "transit", type: "ferry terminal" }
];

function buildQuery(lat: number, lng: number, radius: number): string {
  // Group filters into a single query for efficiency.
  const filters = [
    'node["shop"~"^(supermarket|grocery|greengrocer|convenience|chemist)$"]',
    'node["amenity"~"^(pharmacy|fuel|restaurant|fast_food|cafe|bar|pub|food_court|ice_cream|car_rental|bus_station|taxi|parking|ferry_terminal)$"]',
    'node["tourism"~"^(hotel|motel|hostel|guest_house)$"]',
    'node["aeroway"~"^(aerodrome|terminal)$"]',
    'node["railway"~"^(station|subway_entrance)$"]',
    'node["highway"="bus_stop"]'
  ];

  const aroundParts = filters
    .map((f) => `${f}(around:${radius},${lat},${lng});`)
    .join("\n  ");

  // Also include ways/relations (large buildings like supermarkets) with center output.
  const wayParts = filters
    .map((f) => f.replace(/^node/, "way") + `(around:${radius},${lat},${lng});`)
    .join("\n  ");

  return `[out:json][timeout:10];
(
  ${aroundParts}
  ${wayParts}
);
out tags center 25;`;
}

function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function classify(
  element: OverpassElement
): { category: RewardCategory; type: string } | null {
  const tags = element.tags ?? {};
  for (const rule of TAG_RULES) {
    if (tags[rule.key] === rule.value) {
      return { category: rule.category, type: rule.type };
    }
  }
  return null;
}

export async function detectCategoryFromLocation(
  lat: number,
  lng: number,
  radius = SEARCH_RADIUS_M
): Promise<DetectedPlace> {
  const query = buildQuery(lat, lng, radius);

  let data: OverpassResponse;
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`
    });
    if (!res.ok) {
      throw new Error(`Overpass returned ${res.status}`);
    }
    data = (await res.json()) as OverpassResponse;
  } catch {
    return {
      category: "general",
      type: "unknown location",
      distanceMeters: 0,
      source: "fallback"
    };
  }

  let best: DetectedPlace | null = null;

  for (const el of data.elements) {
    const classification = classify(el);
    if (!classification) continue;

    const elLat = el.lat ?? el.center?.lat;
    const elLng = el.lon ?? el.center?.lon;
    if (elLat === undefined || elLng === undefined) continue;

    const distance = haversine(lat, lng, elLat, elLng);
    const candidate: DetectedPlace = {
      category: classification.category,
      type: classification.type,
      distanceMeters: Math.round(distance),
      source: "overpass"
    };
    const name = el.tags?.name;
    if (name) candidate.name = name;

    if (!best || distance < best.distanceMeters) {
      best = candidate;
    }
  }

  if (!best) {
    return {
      category: "general",
      type: "no nearby merchant",
      distanceMeters: 0,
      source: "fallback"
    };
  }

  return best;
}
