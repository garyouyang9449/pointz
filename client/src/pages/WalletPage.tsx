import { useAppData } from "../AppDataContext";
import { OwnedCardsManager } from "../components/OwnedCardsManager";

export function WalletPage() {
  const {
    bootLoading,
    bootError,
    catalog,
    ownedIds,
    ownedLoading,
    ownedError,
    addCard,
    removeCard
  } = useAppData();

  if (bootLoading) return <div className="status">Loading cards…</div>;
  if (bootError)
    return <div className="status error">Could not load: {bootError}</div>;

  return (
    <main className="layout layout-single">
      <section className="panel controls">
        <h2>Your cards</h2>
        {ownedLoading ? (
          <div className="muted small">Loading your cards…</div>
        ) : (
          <>
            {ownedError && <div className="status error">{ownedError}</div>}
            <OwnedCardsManager
              catalog={catalog}
              ownedIds={ownedIds}
              onAdd={addCard}
              onRemove={removeCard}
            />
          </>
        )}
      </section>
    </main>
  );
}
