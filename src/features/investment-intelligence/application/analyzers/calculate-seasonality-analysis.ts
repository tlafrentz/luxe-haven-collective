import type { MarketSeasonalityAnalysis } from "../analysis/market-seasonality-analysis";

export function calculateMarketSeasonalityAnalysis(): MarketSeasonalityAnalysis {
  return {
    score: 0,
    confidence: 0,
    summary: "",
    strengths: [],
    risks: [],
    opportunities: [],
  };
}
