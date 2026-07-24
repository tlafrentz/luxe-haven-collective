export const portfolioHealthLabels: Readonly<Record<string, string>> = Object.freeze({
  healthy: "Healthy",
  stable: "Stable",
  attention: "Attention required",
  "at-risk": "At risk",
  critical: "Critical",
});
export const portfolioPostureLabels: Readonly<Record<string, string>> = Object.freeze({
  "fund-mandatory-obligations": "Fund mandatory obligations",
  "preserve-liquidity": "Preserve liquidity",
  "remediate-portfolio-risk": "Remediate portfolio risk",
  "improve-existing-assets": "Improve existing properties",
  "pursue-growth": "Pursue growth",
  "allocate-selectively": "Allocate selectively",
  "defer-deployment": "Defer deployment",
  "insufficient-data": "Insufficient data",
});
export function portfolioLabel(value: string): string {
  return portfolioHealthLabels[value] ?? portfolioPostureLabels[value] ??
    value.split("-").map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part).join(" ");
}
export function findingExplanation(code: string): string {
  const labels: Readonly<Record<string, string>> = {
    PORTFOLIO_REVENUE_CONCENTRATED: "Revenue depends heavily on a limited number of contributors.",
    PORTFOLIO_MARKET_CONCENTRATED: "A material share of the portfolio is concentrated in one market.",
    PORTFOLIO_CAPITAL_OVERCOMMITTED: "Current commitments exceed safely available capital.",
    PORTFOLIO_CAPITAL_RESERVE_LOW: "Liquidity protection is below the governing reserve threshold.",
    PORTFOLIO_NOI_NEGATIVE: "Aggregate net operating income is negative for the observation window.",
    PORTFOLIO_SINGLE_PROPERTY_DEPENDENCY: "The portfolio currently depends on one operating property.",
    PORTFOLIO_STRATEGY_MISALIGNED: "Current composition conflicts with an explicit portfolio objective.",
    PORTFOLIO_STRATEGY_ALIGNED: "Current composition supports explicit portfolio objectives.",
    PORTFOLIO_DATA_COVERAGE_LOW: "Important portfolio inputs are incomplete.",
    PORTFOLIO_DATA_STALE: "Important portfolio inputs are no longer current.",
    PORTFOLIO_RISK_CRITICAL: "A critical unresolved portfolio risk is present.",
    PORTFOLIO_REVENUE_DIVERSIFIED: "Revenue contribution is distributed across the portfolio.",
    PORTFOLIO_CAPITAL_RESILIENT: "Capital reserves provide meaningful operating resilience.",
    PORTFOLIO_PERFORMANCE_STRONG: "Aggregate operating performance is strong.",
  };
  return labels[code] ?? portfolioLabel(code.replace(/^PORTFOLIO_/, "").toLowerCase());
}
