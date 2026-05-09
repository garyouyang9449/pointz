import { useMemo } from "react";
import { useAppData } from "../AppDataContext";
import { BestCardResult } from "../components/BestCardResult";
import { AlternativesList } from "../components/AlternativesList";
import { LocationStatus } from "../components/LocationStatus";

export function HomePage() {
  const {
    bootLoading,
    bootError,
    ownedIds,
    coords,
    locStatus,
    locError,
    requestLocation,
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

  return (
    <main className="layout">
      <section className="panel controls">
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
            Add at least one card in your <strong>Wallet</strong> to see
            recommendations.
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
  );
}
