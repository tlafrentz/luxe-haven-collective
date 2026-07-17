import type {
  PurchaseConfidenceAnalysis,
  PurchaseDecisionEvidence,
  PurchaseDecisionRisk,
  PurchaseFailurePoints,
  PurchaseInvestmentAnalysis,
  PurchaseInvestmentRecommendation,
  PurchaseScenario,
} from "../../../domain";

export function buildPurchaseInvestmentRecommendation({
  analysis,
  scenarios,
  failurePoints,
  evidence,
  risks,
  confidence,
}: {
  readonly analysis:
    PurchaseInvestmentAnalysis;
  readonly scenarios:
    readonly PurchaseScenario[];
  readonly failurePoints:
    PurchaseFailurePoints;
  readonly evidence:
    readonly PurchaseDecisionEvidence[];
  readonly risks:
    readonly PurchaseDecisionRisk[];
  readonly confidence:
    PurchaseConfidenceAnalysis;
}): PurchaseInvestmentRecommendation {
  const performance =
    analysis.financialPerformance;
  const downside = scenarios.find(
    ({ type }) => type === "downside",
  );
  const criticalRisks = risks.filter(
    ({ severity }) =>
      severity === "critical",
  );
  const positiveEvidence = evidence.filter(
    ({ positive }) => positive,
  ).length;

  let recommendation:
    PurchaseInvestmentRecommendation["recommendation"];

  if (
    performance.annualCashFlow.amount <= 0 ||
    criticalRisks.length > 0
  ) {
    recommendation = "pass";
  } else if (
    performance.debtServiceCoverageRatio <
      1.1 ||
    failurePoints.occupancySafetyMargin
      .value < 5
  ) {
    recommendation = "wait";
  } else if (
    !downside ||
    downside.annualCashFlow.amount <= 0 ||
    performance.debtServiceCoverageRatio <
      1.25 ||
    confidence.score < 60
  ) {
    recommendation =
      "buy-with-conditions";
  } else if (
    performance.cashOnCashReturn.value >=
      12 &&
    performance.debtServiceCoverageRatio >=
      1.5 &&
    confidence.score >= 75 &&
    positiveEvidence >= 5
  ) {
    recommendation = "strong-buy";
  } else {
    recommendation = "buy";
  }

  const conditions: string[] = [];

  if (
    downside &&
    downside.annualCashFlow.amount <= 0
  ) {
    conditions.push(
      "Improve the downside case until it remains cash-flow positive or fund an explicit operating reserve.",
    );
  }

  if (
    performance.debtServiceCoverageRatio <
    1.25
  ) {
    conditions.push(
      "Improve DSCR to at least 1.25 through price, equity, financing, revenue, or expense changes.",
    );
  }

  if (confidence.score < 70) {
    conditions.push(
      "Increase underwriting confidence with stronger comparable, revenue, and expense evidence.",
    );
  }

  return {
    recommendation,
    headline:
      recommendation === "strong-buy"
        ? "Acquire within the modeled price discipline"
        : recommendation === "buy"
          ? "The acquisition is supportable at the modeled terms"
          : recommendation ===
              "buy-with-conditions"
            ? "Proceed only after resolving the identified conditions"
            : recommendation === "wait"
              ? "Do not advance until the economics improve"
              : "The current acquisition should not proceed",
    rationale:
      recommendation === "pass"
        ? "Current economics or critical risks fail the minimum acquisition standard."
        : `The recommendation reflects ${performance.annualCashFlow.amount.toFixed(0)} in annual cash flow, ${performance.debtServiceCoverageRatio.toFixed(2)} DSCR, a ${failurePoints.occupancySafetyMargin.value}-point occupancy cushion, and ${confidence.score}/100 confidence.`,
    conditions,
    nextActions: [
      "Validate the revenue projection against the strongest nearby comparable properties.",
      "Confirm taxes, insurance, utilities, maintenance, and financing with property-specific quotes.",
      "Set the acquisition ceiling below the maximum supported purchase price.",
      "Re-run underwriting after inspection findings and final loan terms.",
    ],
  };
}
