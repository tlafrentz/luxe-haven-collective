import type {
  PurchaseDecisionOpportunity,
  PurchaseFailurePoints,
  PurchaseInvestmentAnalysis,
  PurchaseScenario,
} from "../../../domain";

export function buildPurchaseDecisionOpportunities({
  analysis,
  scenarios,
  failurePoints,
}: {
  readonly analysis:
    PurchaseInvestmentAnalysis;
  readonly scenarios:
    readonly PurchaseScenario[];
  readonly failurePoints:
    PurchaseFailurePoints;
}): readonly PurchaseDecisionOpportunity[] {
  const opportunities:
    PurchaseDecisionOpportunity[] = [];
  const upside = scenarios.find(
    ({ type }) => type === "upside",
  );
  const performance =
    analysis.financialPerformance;

  if (
    upside &&
    upside.annualCashFlow.amount >
      performance.annualCashFlow.amount
  ) {
    opportunities.push({
      code: "revenue-upside",
      title: "Capture modeled revenue upside",
      finding: `The upside case increases annual cash flow by ${upside.cashFlowChangeFromBase.amount.toFixed(0)}.`,
      expectedUpside:
        "Higher ADR and occupancy improve both cash-on-cash return and debt-service coverage.",
      nextAction:
        "Validate premium positioning, amenity gaps, photography quality, and dynamic-pricing potential against the strongest comparables.",
    });
  }

  if (
    failurePoints
      .purchasePriceSafetyMargin.amount > 0
  ) {
    opportunities.push({
      code: "price-discipline",
      title: "Preserve acquisition-price discipline",
      finding: `The operating model supports approximately ${failurePoints.purchasePriceSafetyMargin.amount.toFixed(0)} above the modeled purchase price before cash flow reaches zero.`,
      expectedUpside:
        "Negotiating below the modeled price increases resilience and levered return.",
      nextAction:
        "Set an offer ceiling below the maximum supported purchase price and preserve room for inspection findings and furnishing overruns.",
    });
  }

  if (
    analysis.expenseProjection.management
      .amount > 0
  ) {
    opportunities.push({
      code: "management-efficiency",
      title: "Improve management efficiency",
      finding:
        "The underwriting includes a recurring management expense.",
      expectedUpside:
        "A lower management burden flows directly to NOI and annual cash flow.",
      nextAction:
        "Compare third-party management, hybrid co-hosting, and owner-operated scenarios without understating labor requirements.",
    });
  }

  return opportunities;
}
