import type { DetectedPlace } from "../types";

interface Props {
  status: "idle" | "requesting" | "ready" | "denied" | "error";
  coords: { lat: number; lng: number } | null;
  place: DetectedPlace | null;
  error: string | null;
  onRefresh: () => void;
}

export function LocationStatus({
  status,
  coords,
  place,
  error,
  onRefresh
}: Props) {
  return (
    <div className="location-status">
      {status === "idle" && (
        <button className="btn primary" onClick={onRefresh}>
          Use my location
        </button>
      )}

      {status === "requesting" && (
        <div className="location-line">
          <span className="spinner" /> Getting your location…
        </div>
      )}

      {status === "denied" && (
        <div className="status error">
          Location permission denied. Enable it in your browser to get
          automatic recommendations.
        </div>
      )}

      {status === "error" && (
        <div className="status error">
          {error ?? "Couldn't determine your location."}
          <button className="btn-link" onClick={onRefresh}>
            Try again
          </button>
        </div>
      )}

      {status === "ready" && coords && (
        <div className="location-ready">
          <div className="location-row">
            <div>
              <div className="muted small">Detected location</div>
              <div className="place-type">
                {place ? formatPlace(place) : "Searching nearby merchants…"}
              </div>
              {place?.name && (
                <div className="muted small">{place.name}</div>
              )}
            </div>
            <button className="btn-link" onClick={onRefresh}>
              Refresh
            </button>
          </div>
          <div className="muted small coords">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            {place && place.source === "overpass" && (
              <> · ~{place.distanceMeters}m away</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatPlace(place: DetectedPlace): string {
  if (place.source === "fallback") {
    return "No specific merchant nearby — using general purchases";
  }
  return `${capitalize(place.type)} (${place.category})`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
