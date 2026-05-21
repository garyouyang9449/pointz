import { getCardsByIds } from "../data/cards.js";
export class RecommendationError extends Error {
    statusCode;
    details;
    constructor(message, statusCode = 400, details) {
        super(message);
        this.statusCode = statusCode;
        this.details = details;
        this.name = "RecommendationError";
    }
}
const DEFAULT_AMOUNT = 1;
export async function recommendCard(input) {
    const amount = input.amount ?? DEFAULT_AMOUNT;
    const uniqueOwnedIds = [...new Set(input.ownedCardIds)];
    const fetched = await getCardsByIds(uniqueOwnedIds);
    const cardById = new Map(fetched.map((card) => [card.id, card]));
    const ownedCards = uniqueOwnedIds.map((id) => cardById.get(id));
    const unknownCardIds = uniqueOwnedIds.filter((_, index) => !ownedCards[index]);
    if (unknownCardIds.length > 0) {
        throw new RecommendationError("Unknown card id provided.", 400, { unknownCardIds });
    }
    const scoredCards = ownedCards.map((card) => scoreCard(card, input.category, amount));
    if (scoredCards.length === 0) {
        throw new RecommendationError("At least one owned card id is required.");
    }
    const rankedCards = scoredCards.sort(compareScoredCards);
    const [best, ...alternatives] = rankedCards;
    return {
        bestCard: best.ranked,
        alternatives: alternatives.map((item) => item.ranked)
    };
}
function scoreCard(card, category, amount) {
    const matchingRule = card.rewardRules.find((rule) => rule.category === category);
    const fallbackRule = card.rewardRules.find((rule) => rule.category === "general");
    const rule = matchingRule ?? fallbackRule;
    if (!rule) {
        throw new RecommendationError(`Card ${card.id} has no usable reward rule.`, 500);
    }
    return {
        card,
        rule,
        usedFallback: !matchingRule,
        ranked: {
            id: card.id,
            name: card.name,
            issuer: card.issuer,
            rewardRate: rule.rate,
            rewardType: rule.rewardType,
            estimatedRewards: estimateRewards(rule, amount),
            matchedCategory: rule.category,
            ...(rule.notes ? { notes: rule.notes } : {})
        }
    };
}
function compareScoredCards(left, right) {
    const rateDifference = right.rule.rate - left.rule.rate;
    if (rateDifference !== 0) {
        return rateDifference;
    }
    const capDifference = Number(Boolean(left.rule.cap)) - Number(Boolean(right.rule.cap));
    if (capDifference !== 0) {
        return capDifference;
    }
    const fallbackDifference = Number(left.usedFallback) - Number(right.usedFallback);
    if (fallbackDifference !== 0) {
        return fallbackDifference;
    }
    return left.card.name.localeCompare(right.card.name) || left.card.id.localeCompare(right.card.id);
}
function estimateRewards(rule, amount) {
    const rewards = rule.rewardType === "cashback_percent" ? amount * (rule.rate / 100) : amount * rule.rate;
    return Number(rewards.toFixed(2));
}
