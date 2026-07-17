import type {
  PurchaseDecisionEvidence,
  PurchaseFailurePoints,
  PurchaseInvestmentAnalysis,
  PurchaseScenario,
} from "../../../domain";

function currency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function buildPurchaseDecisionEvidence({
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
}): readonly PurchaseDecisionEvidence[] {
  const financial =
    analysis.financialPerformance;
  const downside = scenarios.find(
    ({ type }) => type === "downside",
  );

  return [
    {
      category: "financial",
      label: "Annual cash flow",
      finding:
        financial.annualCashFlow.amount > 0
          ? "The base underwriting produces positive annual cash flow."
          : "The base underwriting produces negative annual cash flow.",
      value: currency(
        financial.annualCashFlow.amount,
      ),
      positive:
        financial.annualCashFlow.amount > 0,
    },
    {
      category: "financial",
      label: "Debt-service coverage",
      finding:
        financial.debtServiceCoverageRatio >=
        1.25
          ? "NOI provides a healthy cushion above annual debt service."
          : "Debt-service coverage is below a conservative 1.25 threshold.",
      value:
        financial.debtServiceCoverageRatio.toFixed(
          2,
        ),
      positive:
        financial.debtServiceCoverageRatio >=
        1.25,
    },
    {
      category: "financial",
      label: "Cash-on-cash return",
      finding:
        financial.cashOnCashReturn.value >= 8
          ? "Levered cash return meets a strong initial underwriting threshold."
          : "Levered cash return is below an 8% initial underwriting threshold.",
      value: `${financial.cashOnCashReturn.value}%`,
      positive:
        financial.cashOnCashReturn.value >= 8,
    },
    {
      category: "resilience",
      label: "Downside cash flow",
      finding:
        downside &&
        downside.annualCashFlow.amount > 0
          ? "The modeled downside case remains cash-flow positive."
          : "The modeled downside case reaches or falls below break-even.",
      value: downside
        ? currency(
            downside.annualCashFlow.amount,
          )
        : undefined,
      positive:
        Boolean(
          downside &&
            downside.annualCashFlow.amount > 0,
        ),
    },
    {
      category: "resilience",
      label: "Occupancy cushion",
      finding: `The model can absorb approximately ${failurePoints.occupancySafetyMargin.value} occupancy points before annual cash flow reaches zero.`,
      value: `${failurePoints.occupancySafetyMargin.value} pts`,
      positive:
        failurePoints.occupancySafetyMargin
          .value >= 10,
    },
    {
      category: "financing",
      label: "Supported purchase price",
      finding:
        failurePoints
          .purchasePriceSafetyMargin.amount >= 0
          ? "Current operations support a purchase price above the modeled acquisition price."
          : "Current operations do not support the modeled acquisition price under existing financing.",
      value: currency(
        failurePoints
          .maximumSupportedPurchasePrice.amount,
      ),
      positive:
        failurePoints
          .purchasePriceSafetyMargin.amount >= 0,
    },
  ];
}
