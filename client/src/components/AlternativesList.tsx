import type { RankedCard } from "../types";
import { formatRate, formatRewards } from "./BestCardResult";

interface Props {
  cards: RankedCard[];
  amount: number | undefined;
}

export function AlternativesList({ cards, amount }: Props) {
  return (
    <ul className="alternatives">
      {cards.map((c) => (
        <li key={c.id} className="alt-card">
          <div className="alt-main">
            <div className="alt-name">{c.name}</div>
            <div className="alt-issuer muted small">{c.issuer}</div>
          </div>
          <div className="alt-rate">{formatRate(c.rewardRate, c.rewardType)}</div>
          {amount !== undefined && (
            <div className="alt-reward">
              {formatRewards(c.estimatedRewards, c.rewardType)}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
