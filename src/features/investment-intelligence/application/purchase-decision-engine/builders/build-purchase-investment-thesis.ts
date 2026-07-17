import type {
  PurchaseDecisionEvidence,
  PurchaseDecisionRisk,
  PurchaseInvestmentAnalysis,
  PurchaseInvestmentThesis,
} from "../../../domain";

export function buildPurchaseInvestmentThesis({
  analysis,
  evidence,
  risks,
}: {
  readonly analysis:
    PurchaseInvestmentAnalysis;
  readonly evidence:
    readonly PurchaseDecisionEvidence[];
  readonly risks:
    readonly PurchaseDecisionRisk[];
}): PurchaseInvestmentThesis {
  const performance =
    analysis.financialPerformance;
  const positiveEvidence = evidence.filter(
    ({ positive }) => positive,
  );
  const negativeEvidence = evidence.filter(
    ({ positive }) => !positive,
  );

  const headline =
    performance.annualCashFlow.amount > 0 &&
    performance.debtServiceCoverageRatio >=
      1.25
      ? "Positive economics with a defensible debt-service cushion"
      : performance.annualCashFlow.amount > 0
        ? "Positive cash flow with limited downside protection"
        : "Current underwriting does not support acquisition";

  const summary =
    performance.annualCashFlow.amount > 0
      ? `The purchase produces ${performance.annualCashFlow.amount.toFixed(0)} in modeled annual cash flow, a ${performance.capRate.value}% cap rate, and ${performance.debtServiceCoverageRatio.toFixed(2)} DSCR. The decision depends on preserving the modeled revenue and expense assumptions while addressing ${risks.length} identified risk${risks.length === 1 ? "" : "s"}.`
      : `The purchase produces negative modeled annual cash flow and requires a lower acquisition basis, improved financing, or a stronger operating plan before it should advance.`;

  return {
    headline,
    summary,
    strengths: positiveEvidence
      .slice(0, 4)
      .map(({ finding }) => finding),
    weaknesses: negativeEvidence
      .slice(0, 4)
      .map(({ finding }) => finding),
  };
}
