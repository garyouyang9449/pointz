import type {
  Card,
  CategoryDefinition,
  LocationRecommendationResult,
  RecommendationResult,
  RewardCategory
} from "./types";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

// --- Auth token plumbing ---------------------------------------------------

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

// --- HTTP helpers ----------------------------------------------------------

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) {
    onUnauthorized?.();
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body && typeof body.error === "string") {
        message = body.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  auth?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (opts.auth !== false && authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal
  });
  return handle<T>(res);
}

// --- Public types ----------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

// --- Card / recommendation endpoints (public) -----------------------------

export async function fetchCards(): Promise<Card[]> {
  const data = await request<{ cards: Card[] }>("/cards", { auth: false });
  return data.cards;
}

export async function fetchCategories(): Promise<CategoryDefinition[]> {
  const data = await request<{ categories: CategoryDefinition[] }>(
    "/categories",
    { auth: false }
  );
  return data.categories;
}

export interface LocationCoordinates {
  lat: number;
  lng: number;
  accuracy: "browser" | "ip";
}

export async function fetchLocationFromIp(): Promise<LocationCoordinates> {
  try {
    return await fetchLocationFromPublicProviders();
  } catch {
    return request<LocationCoordinates>("/location", { auth: false });
  }
}

async function fetchLocationFromPublicProviders(): Promise<LocationCoordinates> {
  const providers = [fetchGeoJsLocation, fetchIpInfoLocation];

  for (const provider of providers) {
    try {
      const location = await provider();
      if (location) return location;
    } catch {
      // Try the next provider.
    }
  }

  throw new Error("Unable to determine location from network.");
}

async function fetchGeoJsLocation(): Promise<LocationCoordinates | null> {
  const res = await fetch("https://get.geojs.io/v1/ip/geo.json");
  if (!res.ok) return null;

  const data = (await res.json()) as { latitude?: string; longitude?: string };
  return toLocation(Number(data.latitude), Number(data.longitude));
}

async function fetchIpInfoLocation(): Promise<LocationCoordinates | null> {
  const res = await fetch("https://ipinfo.io/json");
  if (!res.ok) return null;

  const data = (await res.json()) as { loc?: string };
  const [lat, lng] = data.loc?.split(",") ?? [];
  return toLocation(Number(lat), Number(lng));
}

function toLocation(lat: number, lng: number): LocationCoordinates | null {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { lat, lng, accuracy: "ip" };
}

export interface RecommendInput {
  ownedCardIds: string[];
  category: RewardCategory;
  amount?: number;
}

export async function fetchRecommendation(
  input: RecommendInput,
  signal?: AbortSignal
): Promise<RecommendationResult> {
  return request<RecommendationResult>("/recommend", {
    method: "POST",
    body: input,
    signal,
    auth: false
  });
}

export interface RecommendByLocationInput {
  ownedCardIds: string[];
  lat: number;
  lng: number;
  amount?: number;
}

export async function fetchRecommendationByLocation(
  input: RecommendByLocationInput,
  signal?: AbortSignal
): Promise<LocationRecommendationResult> {
  return request<LocationRecommendationResult>("/recommend-by-location", {
    method: "POST",
    body: input,
    signal,
    auth: false
  });
}

// --- Auth endpoints --------------------------------------------------------

export async function signup(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: { email, password },
    auth: false
  });
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: { email, password },
    auth: false
  });
}

export async function me(): Promise<AuthUser> {
  const data = await request<{ user: AuthUser }>("/auth/me");
  return data.user;
}

// --- Owned-cards endpoints (require auth) ---------------------------------

export async function getOwnedCards(): Promise<string[]> {
  const data = await request<{ cardIds: string[] }>("/me/owned-cards");
  return data.cardIds;
}

export async function setOwnedCards(cardIds: string[]): Promise<string[]> {
  const data = await request<{ cardIds: string[] }>("/me/owned-cards", {
    method: "PUT",
    body: { cardIds }
  });
  return data.cardIds;
}

export async function addOwnedCard(cardId: string): Promise<string[]> {
  const data = await request<{ cardIds: string[] }>(
    `/me/owned-cards/${encodeURIComponent(cardId)}`,
    { method: "POST" }
  );
  return data.cardIds;
}

export async function removeOwnedCard(cardId: string): Promise<string[]> {
  const data = await request<{ cardIds: string[] }>(
    `/me/owned-cards/${encodeURIComponent(cardId)}`,
    { method: "DELETE" }
  );
  return data.cardIds;
}
