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
const LOCATION_OPTIONS: PositionOptions[] = [
  { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
  { enableHighAccuracy: false, timeout: 20000, maximumAge: 5 * 60 * 1000 }
];

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

  const requestLocation = useCallback(() => {
    setRefreshNonce((n) => n + 1);
    if (!("geolocation" in navigator)) {
      setLocStatus("error");
      setLocError("Geolocation is not supported by this browser.");
      return;
    }
    setLocStatus("requesting");
    setLocError(null);

    let attempt = 0;
    const tryGetPosition = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocStatus("ready");
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            setLocStatus("denied");
            return;
          }

          attempt += 1;
          if (attempt < LOCATION_OPTIONS.length) {
            tryGetPosition();
            return;
          }

          fetchLocationFromIp()
            .then((location) => {
              setCoords({ lat: location.lat, lng: location.lng });
              setLocStatus("ready");
              setLocError(null);
            })
            .catch(() => {
              setLocStatus("error");
              setLocError(
                "Unable to determine your location from the browser or network."
              );
            });
        },
        LOCATION_OPTIONS[attempt]
      );
    };

    tryGetPosition();
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

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
