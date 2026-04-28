import type {
  Card,
  CategoryDefinition,
  LocationRecommendationResult,
  RecommendationResult,
  RewardCategory
} from "./types";

const BASE = "/api";

async function handle<T>(res: Response): Promise<T> {
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
  return (await res.json()) as T;
}

export async function fetchCards(): Promise<Card[]> {
  const data = await handle<{ cards: Card[] }>(await fetch(`${BASE}/cards`));
  return data.cards;
}

export async function fetchCategories(): Promise<CategoryDefinition[]> {
  const data = await handle<{ categories: CategoryDefinition[] }>(
    await fetch(`${BASE}/categories`)
  );
  return data.categories;
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
  const res = await fetch(`${BASE}/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal
  });
  return handle<RecommendationResult>(res);
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
  const res = await fetch(`${BASE}/recommend-by-location`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal
  });
  return handle<LocationRecommendationResult>(res);
}
