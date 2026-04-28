import { useMemo, useState } from "react";
import type { Card } from "../types";

interface Props {
  cards: Card[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
}

export function CardPicker({ cards, selectedIds, onToggle }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.issuer.toLowerCase().includes(q)
    );
  }, [cards, query]);

  return (
    <div className="card-picker">
      <input
        className="search"
        type="search"
        placeholder="Search by issuer or card name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="card-list">
        {filtered.length === 0 && (
          <div className="muted small">No cards match "{query}".</div>
        )}
        {filtered.map((card) => {
          const checked = selectedIds.has(card.id);
          return (
            <label
              key={card.id}
              className={`card-option${checked ? " checked" : ""}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(card.id)}
              />
              <span className="card-option-body">
                <span className="card-name">{card.name}</span>
                <span className="card-meta">
                  {card.issuer}
                  {card.network ? ` · ${card.network}` : ""}
                  {typeof card.annualFee === "number"
                    ? ` · $${card.annualFee}/yr`
                    : ""}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <div className="muted small selected-count">
        {selectedIds.size} selected
      </div>
    </div>
  );
}
