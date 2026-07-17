import type { IntelligenceHealth } from "@/features/intelligence/domain";

export function buildMarketHealth(): IntelligenceHealth {
  return {
    overallScore: 0,
    status: "fair",
    summary: "",
  };
}
