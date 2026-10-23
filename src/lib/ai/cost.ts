import { AI_PRICES } from "@/config/ai";
import type { TokenUsage } from "./types";

/**
 * Estimated cost in USD from the usage the provider reported, at the price in
 * force on that UTC day; null when the model has no known price or the usage
 * is missing.
 */
export function estimateCostUsd(model: string, usage: TokenUsage, at: Date): number | null {
  const prices = AI_PRICES[model];
  if (!prices || usage.inputTokens === null || usage.outputTokens === null) return null;
  const day = at.toISOString().slice(0, 10);
  const price = prices.findLast((entry) => entry.from === null || entry.from <= day);
  if (!price) return null;
  const outputTokens = usage.outputTokens + (usage.thoughtTokens ?? 0);
  const cost =
    (usage.inputTokens * price.inputPerMillionUsd + outputTokens * price.outputPerMillionUsd) /
    1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
