import type { PortfolioOverviewThresholdPolicy } from "./contracts";

export const PORTFOLIO_OVERVIEW_POLICY: PortfolioOverviewThresholdPolicy = Object.freeze({
  version: "portfolio-overview-v1",
  materialRevenuePercent: 0.05,
  materialAdrPercent: 0.04,
  materialOccupancyPoints: 0.03,
  materialBookingPercent: 0.08,
  materialContributionShare: 0.35,
  severeRevenueDeclinePercent: 0.2,
  severeOccupancyDeclinePoints: 0.1,
  minimumComparisonCoverage: 0.8,
  maximumChanges: 5,
});
