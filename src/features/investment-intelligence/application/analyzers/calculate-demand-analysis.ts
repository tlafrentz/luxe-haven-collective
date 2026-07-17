import type { MarketDemandAnalysis } from "../analysis/market-demand-analysis";

export function calculateMarketDemandAnalysis(): MarketDemandAnalysis {
  return {
    score: 0,
    confidence: 0,
    summary: "",
    strengths: [],
    risks: [],
    opportunities: [],
  };
}
