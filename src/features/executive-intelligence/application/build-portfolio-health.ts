import type {
  HpmPerformanceReport,
} from "@/features/hpm";

import type {
  PortfolioHealth,
} from "../domain";

export function buildPortfolioHealth(
  hpmPerformance: HpmPerformanceReport,
): PortfolioHealth {
  const revenue =
    hpmPerformance.pillars.revenue;

  const coverage =
    hpmPerformance.dataCoverage
      .coveragePercentage;

  if (hpmPerformance.overall.score !== null) {
    return {
      score:
        hpmPerformance.overall.score,
      healthStatus:
        hpmPerformance.overall
          .healthStatus,
      measurementStatus:
        hpmPerformance.overall
          .measurementStatus,
      confidence:
        hpmPerformance.overall.confidence,
      change:
        hpmPerformance.overall.change,
      headline:
        "Portfolio health is available",
      summary:
        "The HPM score reflects performance across the currently measured pillars.",
    };
  }

  return {
    score: null,
    healthStatus: "unavailable",
    measurementStatus: "partial",
    confidence: null,
    change: null,
    headline:
      "Portfolio health is being established",
    summary:
      revenue.score === null
        ? `${coverage}% of the HPM framework currently has usable data. Additional data sources are required before portfolio health can be scored.`
        : `Revenue performance is currently ${revenue.healthStatus} with a score of ${revenue.score}. Overall HPM health will become available as financial, operational, guest, investment, and growth data are connected.`,
  };
}
