import type {
  PurchaseDecisionRisk,
  PurchaseFailurePoints,
  PurchaseInvestmentAnalysis,
  PurchaseScenario,
} from "../../../domain";

export function buildPurchaseDecisionRisks({
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
}): readonly PurchaseDecisionRisk[] {
  const risks: PurchaseDecisionRisk[] = [];
  const performance =
    analysis.financialPerformance;
  const downside = scenarios.find(
    ({ type }) => type === "downside",
  );

  if (
    performance.debtServiceCoverageRatio <
    1.25
  ) {
    risks.push({
      code: "thin-dscr",
      title: "Thin debt-service coverage",
      severity:
        performance.debtServiceCoverageRatio <
        1
          ? "critical"
          : "high",
      finding: `Modeled DSCR is ${performance.debtServiceCoverageRatio.toFixed(2)}.`,
      impact:
        "A modest revenue shortfall or expense increase could impair debt coverage.",
      mitigation:
        "Reduce purchase price, increase the down payment, improve financing terms, or validate stronger operating performance.",
    });
  }

  if (
    failurePoints.occupancySafetyMargin.value <
    10
  ) {
    risks.push({
      code: "occupancy-sensitivity",
      title: "Limited occupancy cushion",
      severity:
        failurePoints.occupancySafetyMargin
          .value < 5
          ? "high"
          : "medium",
      finding: `Only ${failurePoints.occupancySafetyMargin.value} occupancy points separate the base case from break-even.`,
      impact:
        "Seasonality or competitive supply could eliminate annual cash flow.",
      mitigation:
        "Validate monthly demand, establish a mid-term rental fallback, and underwrite a larger occupancy reserve.",
    });
  }

  if (
    failurePoints
      .adrSafetyMarginPercentage.value < 10
  ) {
    risks.push({
      code: "adr-sensitivity",
      title: "Limited ADR cushion",
      severity:
        failurePoints
          .adrSafetyMarginPercentage.value < 5
          ? "high"
          : "medium",
      finding: `The model can absorb only ${failurePoints.adrSafetyMarginPercentage.value}% of ADR compression.`,
      impact:
        "Competitive pricing pressure could materially reduce cash flow.",
      mitigation:
        "Validate comparable ADR by season and avoid relying on premium positioning that is not supported by the property.",
    });
  }

  if (
    downside &&
    downside.annualCashFlow.amount <= 0
  ) {
    risks.push({
      code: "downside-loss",
      title: "Downside scenario loses money",
      severity:
        downside.annualCashFlow.amount < -5000
          ? "high"
          : "medium",
      finding: `The modeled downside produces ${downside.annualCashFlow.amount.toFixed(0)} in annual cash flow.`,
      impact:
        "The acquisition may require additional owner capital during a normal market slowdown.",
      mitigation:
        "Negotiate price or concessions, increase operating reserves, and validate a lower-cost operating plan before acquisition.",
    });
  }

  if (
    failurePoints
      .purchasePriceSafetyMargin.amount < 0
  ) {
    risks.push({
      code: "unsupported-price",
      title: "Purchase price exceeds supported value",
      severity: "critical",
      finding:
        "The modeled acquisition price is above the maximum price supported by current operating assumptions and financing.",
      impact:
        "The property begins with structurally insufficient cash flow.",
      mitigation:
        "Lower the offer price, increase equity, improve financing terms, or pass.",
    });
  }

  return risks;
}
