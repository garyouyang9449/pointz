import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import {
  addOwnedCard,
  fetchCards,
  fetchLocationFromIp,
  fetchRecommendationByLocation,
  getOwnedCards,
  removeOwnedCard,
  setOwnedCards as apiSetOwnedCards
} from "./api";
import type {
  Card,
  DetectedPlace,
  LocationRecommendationResult
} from "./types";

export type LocStatus = "idle" | "requesting" | "ready" | "denied" | "error";

const LEGACY_OWNED_IDS_KEY = "pointz.ownedCardIds";
const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 30_000,
  timeout: 30_000
};

const MANUAL_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 15_000
};

// Minimum movement (in meters) required to accept a new fix from the
// continuous watcher and trigger a recommendation refresh. Manual refreshes
// bypass this threshold.
const MIN_MOVE_METERS = 200;

const EARTH_RADIUS_METERS = 6_371_000;

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

function loadLegacyOwnedIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEGACY_OWNED_IDS_KEY);
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

interface AppDataValue {
  catalog: Card[];
  bootError: string | null;
  bootLoading: boolean;

  ownedIds: string[];
  ownedLoading: boolean;
  ownedError: string | null;
  addCard: (id: string) => Promise<void>;
  removeCard: (id: string) => Promise<void>;

  coords: { lat: number; lng: number } | null;
  locStatus: LocStatus;
  locError: string | null;
  requestLocation: () => void;

  result: LocationRecommendationResult | null;
  recError: string | null;
  recLoading: boolean;
  detectedPlace: DetectedPlace | null;
}

const AppDataContext = createContext<AppDataValue | undefined>(undefined);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Card[]>([]);
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootLoading, setBootLoading] = useState(true);

  const [ownedIds, setOwnedIds] = useState<string[]>([]);
  const [ownedLoading, setOwnedLoading] = useState(true);
  const [ownedError, setOwnedError] = useState<string | null>(null);

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
  const [refreshNonce, setRefreshNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await fetchCards();
        if (!cancelled) setCatalog(c);
      } catch (err) {
        if (!cancelled) {
          setBootError(
            err instanceof Error ? err.message : "Failed to load cards"
          );
        }
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const serverIds = await getOwnedCards();
        if (cancelled) return;

        if (serverIds.length === 0) {
          const legacy = loadLegacyOwnedIds();
          if (legacy.length > 0) {
            try {
              const synced = await apiSetOwnedCards(legacy);
              if (!cancelled) {
                setOwnedIds(synced);
                window.localStorage.removeItem(LEGACY_OWNED_IDS_KEY);
              }
              return;
            } catch {
              // ignore
            }
          }
        }

        setOwnedIds(serverIds);
      } catch (err) {
        if (!cancelled) {
          setOwnedError(
            err instanceof Error ? err.message : "Failed to load your cards"
          );
        }
      } finally {
        if (!cancelled) setOwnedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mutatingRef = useRef(false);

  const addCard = useCallback(async (id: string) => {
    if (mutatingRef.current) return;
    setOwnedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    mutatingRef.current = true;
    try {
      const next = await addOwnedCard(id);
      setOwnedIds(next);
    } catch (err) {
      setOwnedError(err instanceof Error ? err.message : "Failed to add card");
      setOwnedIds((prev) => prev.filter((x) => x !== id));
    } finally {
      mutatingRef.current = false;
    }
  }, []);

  const removeCard = useCallback(
    async (id: string) => {
      if (mutatingRef.current) return;
      const snapshot = ownedIds;
      setOwnedIds((prev) => prev.filter((x) => x !== id));
      mutatingRef.current = true;
      try {
        const next = await removeOwnedCard(id);
        setOwnedIds(next);
      } catch (err) {
        setOwnedError(
          err instanceof Error ? err.message : "Failed to remove card"
        );
        setOwnedIds(snapshot);
      } finally {
        mutatingRef.current = false;
      }
    },
    [ownedIds]
  );

  const watchIdRef = useRef<number | null>(null);
  const lastAcceptedCoordsRef = useRef<{ lat: number; lng: number } | null>(
    null
  );
  // Tracks whether we've already fallen back to IP-based geolocation during
  // the current "no fix yet" streak. Reset whenever we get a good fix so a
  // later prolonged outage can fall back again.
  const ipFallbackTriedRef = useRef(false);
  const ipFallbackInFlightRef = useRef(false);

  const acceptFix = useCallback(
    (next: { lat: number; lng: number }, force: boolean) => {
      const last = lastAcceptedCoordsRef.current;
      if (!force && last && haversineMeters(last, next) < MIN_MOVE_METERS) {
        // Movement below threshold — ignore to avoid recommendation churn.
        return false;
      }
      lastAcceptedCoordsRef.current = next;
      setCoords(next);
      setLocStatus("ready");
      setLocError(null);
      ipFallbackTriedRef.current = false;
      return true;
    },
    []
  );

  const tryIpFallback = useCallback(() => {
    if (ipFallbackInFlightRef.current) return;
    ipFallbackInFlightRef.current = true;
    fetchLocationFromIp()
      .then((location) => {
        acceptFix({ lat: location.lat, lng: location.lng }, true);
      })
      .catch(() => {
        // Only surface an IP-fallback error if we still have no coords at all.
        if (!lastAcceptedCoordsRef.current) {
          setLocStatus("error");
          setLocError(
            "Unable to determine your location from the browser or network."
          );
        }
      })
      .finally(() => {
        ipFallbackInFlightRef.current = false;
      });
  }, [acceptFix]);

  const requestLocation = useCallback(() => {
    setRefreshNonce((n) => n + 1);
    if (!("geolocation" in navigator)) {
      setLocStatus("error");
      setLocError("Geolocation is not supported by this browser.");
      return;
    }
    if (!lastAcceptedCoordsRef.current) {
      setLocStatus("requesting");
    }
    setLocError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        acceptFix(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          true
        );
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocStatus("denied");
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          return;
        }
        // Manual refresh always allows an IP fallback attempt.
        ipFallbackTriedRef.current = true;
        tryIpFallback();
      },
      MANUAL_OPTIONS
    );
  }, [acceptFix, tryIpFallback]);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocStatus("error");
      setLocError("Geolocation is not supported by this browser.");
      return;
    }

    setLocStatus("requesting");
    setLocError(null);

    // Force a fresh (uncached) location read on mount so that reloading the
    // page always refreshes the user's location rather than reusing a
    // browser-cached fix from the watcher's maximumAge window.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        acceptFix(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          true
        );
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocStatus("denied");
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          return;
        }
        if (lastAcceptedCoordsRef.current) return;
        if (ipFallbackTriedRef.current) return;
        ipFallbackTriedRef.current = true;
        tryIpFallback();
      },
      MANUAL_OPTIONS
    );

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        acceptFix(
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          false
        );
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocStatus("denied");
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          return;
        }
        // If we already have a previous fix, swallow the transient error;
        // the watcher will keep retrying internally.
        if (lastAcceptedCoordsRef.current) return;
        if (ipFallbackTriedRef.current) return;
        ipFallbackTriedRef.current = true;
        tryIpFallback();
      },
      WATCH_OPTIONS
    );

    watchIdRef.current = id;
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [acceptFix, tryIpFallback]);

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
        setRecError(
          err instanceof Error ? err.message : "Recommendation failed"
        );
        setResult(null);
      } finally {
        setRecLoading(false);
      }
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [ownedIds, coords, refreshNonce]);

  const detectedPlace: DetectedPlace | null = result?.place ?? null;

  const value = useMemo<AppDataValue>(
    () => ({
      catalog,
      bootError,
      bootLoading,
      ownedIds,
      ownedLoading,
      ownedError,
      addCard,
      removeCard,
      coords,
      locStatus,
      locError,
      requestLocation,
      result,
      recError,
      recLoading,
      detectedPlace
    }),
    [
      catalog,
      bootError,
      bootLoading,
      ownedIds,
      ownedLoading,
      ownedError,
      addCard,
      removeCard,
      coords,
      locStatus,
      locError,
      requestLocation,
      result,
      recError,
      recLoading,
      detectedPlace
    ]
  );

  return (
    <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
  );
}

export function useAppData(): AppDataValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error("useAppData must be used within AppDataProvider");
  }
  return ctx;
}
