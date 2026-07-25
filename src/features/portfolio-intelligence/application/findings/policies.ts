import type{PortfolioFindingsPolicy}from"./contracts";
export const PORTFOLIO_FINDINGS_POLICY:PortfolioFindingsPolicy=Object.freeze({
 version:"portfolio-findings-v1",minimumEvidenceCoverage:.6,materialRevenueDecline:-.05,
 materialOccupancyDeclinePoints:-.03,materialRevenueGrowth:.05,
 materialConcentrationStatus:["highly-concentrated","critical-dependency"] as const,
 highBurdenShare:.35,lowRevenueShare:.2,maximumPerKind:8,
});
