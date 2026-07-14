import type {
  HpmPerformanceReport,
} from "@/features/hpm";

import type {
  ExecutiveBrief,
  ExecutivePriority,
  PortfolioSnapshot,
  RevenueRiskSummary,
} from "../domain";

type BuildExecutiveBriefParams = {
  hpmPerformance: HpmPerformanceReport;
  portfolioSnapshot: PortfolioSnapshot;
  revenueRisk: RevenueRiskSummary;
  priorities: ExecutivePriority[];
};

export function buildExecutiveBrief({
  hpmPerformance,
  portfolioSnapshot,
  revenueRisk,
  priorities,
}: BuildExecutiveBriefParams): ExecutiveBrief {
  const revenue =
    hpmPerformance.pillars.revenue;

  const revenueTrend =
    portfolioSnapshot.grossRevenue.trend;

  const highlights: string[] = [];
  const concerns: string[] = [];

  if (
    revenueTrend?.direction === "up"
  ) {
    highlights.push(
      `Gross revenue increased ${revenueTrend.percentChange.toFixed(
        1,
      )}% compared with the previous period.`,
    );
  }

  if (
    portfolioSnapshot.occupancyRate.trend
      ?.direction === "up"
  ) {
    highlights.push(
      `Occupancy improved ${portfolioSnapshot.occupancyRate.trend.percentChange.toFixed(
        1,
      )}% compared with the previous period.`,
    );
  }

  if (
    portfolioSnapshot.revPar.trend
      ?.direction === "up"
  ) {
    highlights.push(
      `RevPAR increased ${portfolioSnapshot.revPar.trend.percentChange.toFixed(
        1,
      )}%.`,
    );
  }

  if (
    revenueTrend?.direction === "down"
  ) {
    concerns.push(
      `Gross revenue declined ${Math.abs(
        revenueTrend.percentChange,
      ).toFixed(
        1,
      )}% compared with the previous period.`,
    );
  }

  if (revenueRisk.itemCount > 0) {
    concerns.push(
      `${revenueRisk.itemCount} revenue-risk ${
        revenueRisk.itemCount === 1
          ? "item is"
          : "items are"
      } currently active.`,
    );
  }

  if (
    portfolioSnapshot.cancelledBookings >
    0
  ) {
    concerns.push(
      `${portfolioSnapshot.cancelledBookings} cancelled ${
        portfolioSnapshot.cancelledBookings ===
        1
          ? "booking was"
          : "bookings were"
      } recorded during the reporting period.`,
    );
  }

  const topPriority = priorities[0];

  const tone: ExecutiveBrief["tone"] =
    revenue.healthStatus === "critical" ||
    revenueRisk.items.some(
      (item) =>
        item.confidence === "high" &&
        item.estimatedAmount > 0,
    )
      ? "critical"
      : revenue.healthStatus ===
            "needs-attention" ||
          revenue.healthStatus === "watch" ||
          concerns.length > highlights.length
        ? "warning"
        : highlights.length > 0 &&
            concerns.length === 0
          ? "positive"
          : "balanced";

  const headline =
    topPriority !== undefined
      ? `${topPriority.title} is the leading priority`
      : "No urgent revenue priorities were detected";

  const summary =
    revenue.score === null
      ? "Revenue performance could not be scored for the selected period."
      : `Revenue performance is ${revenue.healthStatus} with a score of ${revenue.score}. The portfolio generated ${portfolioSnapshot.grossRevenue.value.toLocaleString(
          "en-US",
          {
            style: "currency",
            currency:
              revenueRisk.currency || "USD",
            maximumFractionDigits: 0,
          },
        )} in gross revenue at ${portfolioSnapshot.occupancyRate.value.toFixed(
          1,
        )}% occupancy.`;

  return {
    headline,
    summary,
    tone,
    highlights,
    concerns,
    recommendedFocus:
      topPriority?.action.summary ??
      "Continue monitoring performance as additional HPM data sources become available.",
  };
}
