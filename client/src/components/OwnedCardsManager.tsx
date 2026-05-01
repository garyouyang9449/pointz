import { useMemo, useState } from "react";
import type { Card } from "../types";

interface Props {
  catalog: Card[];
  ownedIds: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}

export function OwnedCardsManager({ catalog, ownedIds, onAdd, onRemove }: Props) {
  const [selected, setSelected] = useState("");

  const ownedSet = useMemo(() => new Set(ownedIds), [ownedIds]);

  const available = useMemo(
    () => catalog.filter((c) => !ownedSet.has(c.id)),
    [catalog, ownedSet]
  );

  const ownedCards = useMemo(
    () => ownedIds.map((id) => catalog.find((c) => c.id === id)).filter(Boolean) as Card[],
    [catalog, ownedIds]
  );

  const handleAdd = () => {
    if (!selected) return;
    onAdd(selected);
    setSelected("");
  };

  return (
    <div className="owned-cards">
      <div className="owned-cards-row">
        <select
          className="owned-cards-select"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={available.length === 0}
        >
          <option value="">
            {available.length === 0
              ? "All cards added"
              : "Select a card to add…"}
          </option>
          {available.map((card) => (
            <option key={card.id} value={card.id}>
              {card.issuer} — {card.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn primary"
          onClick={handleAdd}
          disabled={!selected}
        >
          Add
        </button>
      </div>

      {ownedCards.length === 0 ? (
        <div className="muted small owned-empty">
          No cards added yet. Pick one above to start getting recommendations.
        </div>
      ) : (
        <ul className="owned-list">
          {ownedCards.map((card) => (
            <li key={card.id} className="owned-item">
              <div className="owned-item-body">
                <div className="card-name">{card.name}</div>
                <div className="card-meta">{card.issuer}</div>
              </div>
              <button
                type="button"
                className="btn-link"
                onClick={() => onRemove(card.id)}
                aria-label={`Remove ${card.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
