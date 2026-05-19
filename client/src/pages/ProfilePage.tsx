import { useAppData } from "../AppDataContext";
import { useAuth } from "../auth/AuthContext";
import { OwnedCardsManager } from "../components/OwnedCardsManager";

export function ProfilePage() {
  const { user } = useAuth();
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
      <section className="panel">
        <h2>Profile</h2>
        <div className="profile-info">
          <span className="profile-info-label">Email</span>
          <span className="profile-info-value">{user?.email ?? "—"}</span>
        </div>
      </section>
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
