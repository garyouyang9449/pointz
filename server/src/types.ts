export type RewardCategory =
  | "dining"
  | "groceries"
  | "gas"
  | "travel"
  | "transit"
  | "drugstores"
  | "streaming"
  | "general";

export type RewardType = "points" | "miles" | "cashback_percent";

export type CardNetwork = "visa" | "mastercard" | "amex" | "discover";

export interface RewardCap {
  amount: number;
  period: "month" | "quarter" | "year";
}

export interface RewardRule {
  category: RewardCategory;
  rate: number;
  rewardType: RewardType;
  cap?: RewardCap;
  notes?: string;
}

export interface Card {
  id: string;
  issuer: string;
  name: string;
  network?: CardNetwork;
  annualFee?: number;
  rewardRules: RewardRule[];
}

export interface RankedCard {
  id: string;
  name: string;
  issuer: string;
  rewardRate: number;
  rewardType: RewardType;
  estimatedRewards: number;
  matchedCategory: RewardCategory;
  notes?: string;
}

export interface RecommendationResult {
  bestCard: RankedCard;
  alternatives: RankedCard[];
}
