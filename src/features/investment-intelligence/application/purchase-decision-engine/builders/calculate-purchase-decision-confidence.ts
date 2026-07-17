import type {
  PurchaseConfidenceAnalysis,
  PurchaseConfidenceFactor,
  PurchaseFailurePoints,
  PurchaseInvestmentAnalysis,
  PurchaseScenario,
} from "../../../domain";

function clamp(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function round(value: number): number {
  return Math.round(value);
}

export function calculatePurchaseDecisionConfidence({
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
}): PurchaseConfidenceAnalysis {
  const downside = scenarios.find(
    ({ type }) => type === "downside",
  );

  const factors: PurchaseConfidenceFactor[] = [
    {
      label: "Revenue projection",
      score: clamp(
        analysis.revenueProjection.confidence
          .value,
      ),
      weight: 30,
      explanation:
        "Confidence assigned to projected ADR, occupancy, and annual revenue.",
    },
    {
      label: "Expense projection",
      score: clamp(
        analysis.expenseProjection.confidence
          .value,
      ),
      weight: 25,
      explanation:
        "Confidence assigned to recurring operating expenses.",
    },
    {
      label: "Scenario resilience",
      score: downside
        ? clamp(
            50 +
              downside.annualCashFlow.amount /
                250,
          )
        : 25,
      weight: 25,
      explanation:
        "Measures whether the downside case preserves annual cash flow.",
    },
    {
      label: "Failure-point margin",
      score: clamp(
        (
          failurePoints
            .adrSafetyMarginPercentage.value +
          failurePoints
            .occupancySafetyMargin.value
        ) * 3,
      ),
      weight: 20,
      explanation:
        "Measures the combined ADR and occupancy cushion before break-even.",
    },
  ];

  const score = round(
    factors.reduce(
      (total, factor) =>
        total +
        factor.score *
          (factor.weight / 100),
      0,
    ),
  );

  const level =
    score >= 85
      ? "very-high"
      : score >= 70
        ? "high"
        : score >= 55
          ? "medium"
          : score >= 40
            ? "low"
            : "very-low";

  return {
    score,
    level,
    factors,
    explanation: `The ${score}/100 confidence score combines revenue quality, expense quality, downside resilience, and break-even safety margins.`,
  };
}
