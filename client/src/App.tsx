import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchCards,
  fetchRecommendationByLocation
} from "./api";
import type {
  Card,
  DetectedPlace,
  LocationRecommendationResult
} from "./types";
import { BestCardResult } from "./components/BestCardResult";
import { AlternativesList } from "./components/AlternativesList";
import { LocationStatus } from "./components/LocationStatus";
import { OwnedCardsManager } from "./components/OwnedCardsManager";

type LocStatus = "idle" | "requesting" | "ready" | "denied" | "error";

const OWNED_IDS_STORAGE_KEY = "pointz.ownedCardIds";

function loadOwnedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(OWNED_IDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
      return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

export function App() {
  const [catalog, setCatalog] = useState<Card[]>([]);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootLoading, setBootLoading] = useState(true);

  const [ownedIds, setOwnedIds] = useState<string[]>(() => loadOwnedIds());

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );
  const [locStatus, setLocStatus] = useState<LocStatus>("idle");
  const [locError, setLocError] = useState<string | null>(null);

  const [result, setResult] = useState<LocationRecommendationResult | null>(
    null
  );
  const [recError, setRecError] = useState<string | null>(null);
  const [recLoading, setRecLoading] = useState(false);

  // Load catalog of all cards from server
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await fetchCards();
        if (!cancelled) setCatalog(c);
      } catch (err) {
        if (!cancelled) {
          setBootError(err instanceof Error ? err.message : "Failed to load cards");
        }
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist owned ids
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        OWNED_IDS_STORAGE_KEY,
        JSON.stringify(ownedIds)
      );
    } catch {
      // ignore
    }
  }, [ownedIds]);

  const addCard = useCallback((id: string) => {
    setOwnedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const removeCard = useCallback((id: string) => {
    setOwnedIds((prev) => prev.filter((x) => x !== id));
  }, []);

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocStatus("error");
      setLocError("Geolocation is not supported by this browser.");
      return;
    }
    setLocStatus("requesting");
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocStatus("ready");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocStatus("denied");
        } else {
          setLocStatus("error");
          setLocError(err.message);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30_000 }
    );
  }, []);

  // Auto-request on mount
  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Live recompute when inputs change
  useEffect(() => {
    if (ownedIds.length === 0 || !coords) {
      setResult(null);
      setRecError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setRecLoading(true);
      setRecError(null);
      try {
        const data = await fetchRecommendationByLocation(
          {
            ownedCardIds: ownedIds,
            lat: coords.lat,
            lng: coords.lng
          },
          controller.signal
        );
        setResult(data);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setRecError(err instanceof Error ? err.message : "Recommendation failed");
        setResult(null);
      } finally {
        setRecLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [ownedIds, coords]);

  const detectedPlace: DetectedPlace | null = result?.place ?? null;

  const pseudoSelectedCategory = useMemo(() => {
    if (!detectedPlace) return null;
    return {
      id: detectedPlace.category,
      name: detectedPlace.type,
      description: ""
    };
  }, [detectedPlace]);

  return (
    <div className="app">
      <header className="header">
        <h1>
          <span className="logo">●</span> Pointz
        </h1>
        <p className="tagline">
          Automatically picks the card that earns the most — based on where you
          are.
        </p>
      </header>

      {bootLoading && <div className="status">Loading cards…</div>}
      {bootError && <div className="status error">Could not load: {bootError}</div>}

      {!bootLoading && !bootError && (
        <main className="layout">
          <section className="panel controls">
            <h2>Your cards</h2>
            <OwnedCardsManager
              catalog={catalog}
              ownedIds={ownedIds}
              onAdd={addCard}
              onRemove={removeCard}
            />

            <h2>Where you are</h2>
            <LocationStatus
              status={locStatus}
              coords={coords}
              place={detectedPlace}
              error={locError}
              onRefresh={requestLocation}
            />
          </section>

          <section className="panel results">
            <h2>Best card to use</h2>

            {ownedIds.length === 0 && (
              <div className="empty">
                Add at least one card to see recommendations.
              </div>
            )}

            {ownedIds.length > 0 && !coords && locStatus !== "requesting" && (
              <div className="empty">
                Share your location to get an automatic recommendation.
              </div>
            )}

            {recError && <div className="status error">{recError}</div>}

            {result && (
              <>
                <BestCardResult
                  card={result.bestCard}
                  selectedCategory={pseudoSelectedCategory}
                  amount={undefined}
                  loading={recLoading}
                />
                {result.alternatives.length > 0 && (
                  <>
                    <h3 className="alts-heading">Other options</h3>
                    <AlternativesList
                      cards={result.alternatives}
                      amount={undefined}
                    />
                  </>
                )}
              </>
            )}
          </section>
        </main>
      )}
    </div>
  );
}
