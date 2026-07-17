import type { MarketIntelligenceReport } from "../domain/entities/market-intelligence-report";

import { calculateMarketHealth } from "./calculate-market-health";

export type BuildMarketIntelligenceInput = Omit<
  MarketIntelligenceReport,
  "health" | "recommendation"
> & {
  readonly score: number;
};

export function buildMarketIntelligence(
  input: BuildMarketIntelligenceInput,
): MarketIntelligenceReport {
  const {
    score,
    ...report
  } = input;

  return {
    ...report,
    health: calculateMarketHealth(score),
    recommendation:
      score >= 70
        ? "Pursue this market"
        : "Investigate further",
  };
}
