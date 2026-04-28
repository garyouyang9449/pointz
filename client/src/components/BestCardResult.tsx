import type { CategoryDefinition, RankedCard, RewardType } from "../types";

interface Props {
  card: RankedCard;
  selectedCategory: CategoryDefinition | null;
  amount: number | undefined;
  loading: boolean;
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
});
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function formatRate(rate: number, type: RewardType): string {
  switch (type) {
    case "cashback_percent":
      return `${number.format(rate)}% cash back`;
    case "points":
      return `${number.format(rate)}x points`;
    case "miles":
      return `${number.format(rate)}x miles`;
  }
}

export function formatRewards(value: number, type: RewardType): string {
  if (type === "cashback_percent") return currency.format(value);
  return `${number.format(value)} ${type}`;
}

export function BestCardResult({
  card,
  selectedCategory,
  amount,
  loading
}: Props) {
  const usedFallback =
    selectedCategory !== null && card.matchedCategory !== selectedCategory.id;

  return (
    <div className={`best-card${loading ? " loading" : ""}`}>
      <div className="best-card-header">
        <div>
          <div className="best-card-name">{card.name}</div>
          <div className="best-card-issuer">{card.issuer}</div>
        </div>
        <div className="best-card-rate">{formatRate(card.rewardRate, card.rewardType)}</div>
      </div>

      <div className="best-card-body">
        <div className="best-card-stat">
          <span className="muted small">Matched category</span>
          <span className="badge">
            {card.matchedCategory}
            {usedFallback && " (fallback)"}
          </span>
        </div>

        {amount !== undefined && (
          <div className="best-card-stat">
            <span className="muted small">Estimated reward on {currency.format(amount)}</span>
            <span className="best-card-reward">
              {formatRewards(card.estimatedRewards, card.rewardType)}
            </span>
          </div>
        )}
      </div>

      {usedFallback && (
        <div className="hint">
          This card has no specific bonus for{" "}
          <strong>{selectedCategory?.name.toLowerCase()}</strong>, so its general rate is used.
        </div>
      )}

      {card.notes && <div className="hint">{card.notes}</div>}
    </div>
  );
}
