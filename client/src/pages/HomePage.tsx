import { useMemo } from "react";
import { useAppData } from "../AppDataContext";
import { BestCardResult } from "../components/BestCardResult";
import { AlternativesList } from "../components/AlternativesList";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function HomePage() {
  const {
    bootLoading,
    bootError,
    ownedIds,
    coords,
    locStatus,
    locError,
    result,
    recError,
    recLoading,
    detectedPlace
  } = useAppData();

  const pseudoSelectedCategory = useMemo(() => {
    if (!detectedPlace) return null;
    return {
      id: detectedPlace.category,
      name: detectedPlace.type,
      description: ""
    };
  }, [detectedPlace]);

  if (bootLoading) return <div className="status">Loading cards…</div>;
  if (bootError)
    return <div className="status error">Could not load: {bootError}</div>;

  const locationLine = (() => {
    if (!coords) return null;
    const coordStr = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
    if (detectedPlace && detectedPlace.source !== "fallback") {
      return `${coordStr} · ${capitalize(detectedPlace.type)} (${detectedPlace.category})`;
    }
    if (detectedPlace && detectedPlace.source === "fallback") {
      return `${coordStr} · General purchases`;
    }
    return coordStr;
  })();

  return (
    <main className="layout layout-single">
      <section className="panel results">
        <h2>Best card to use</h2>

        {locationLine && (
          <div className="muted small coords location-meta">{locationLine}</div>
        )}

        {locStatus === "error" && locError && (
          <div className="status error">{locError}</div>
        )}

        {ownedIds.length === 0 && (
          <div className="empty">
            Add at least one card in your <strong>Wallet</strong> to see
            recommendations.
          </div>
        )}

        {ownedIds.length > 0 && !coords && locStatus !== "error" && (
          <div className="empty">Waiting for location…</div>
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
  );
}
