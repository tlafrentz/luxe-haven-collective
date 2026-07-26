export const PROFITABILITY_POLICY_VERSION = "profitability-policy-v1";
export const PROFITABILITY_POLICY = Object.freeze({
  minimumExpenseCoverage: .8, materialMinorUnits: 10_000,
  strongMargin: .35, healthyMargin: .2, moderateMargin: .1, weakMargin: 0,
  stableVarianceShare: .02,
});

export function marginHealth(margin: number | null) {
  return margin === null ? "unavailable" as const : margin >= PROFITABILITY_POLICY.strongMargin ? "strong" as const
    : margin >= PROFITABILITY_POLICY.healthyMargin ? "healthy" as const
      : margin >= PROFITABILITY_POLICY.moderateMargin ? "moderate" as const
        : margin >= PROFITABILITY_POLICY.weakMargin ? "weak" as const : "negative" as const;
}

export function safePercentageChange(current: number, previous: number): number | null {
  return Math.abs(previous) < PROFITABILITY_POLICY.materialMinorUnits / 100 ? null : (current - previous) / Math.abs(previous);
}

export function trendClassification(current: number | null, previous: number | null, favorableIncreasing: boolean) {
  if (current === null || previous === null) return "insufficient-evidence" as const;
  const difference = current - previous;
  const denominator = Math.max(Math.abs(previous), 1);
  if (Math.abs(difference) / denominator < PROFITABILITY_POLICY.stableVarianceShare) return "stable" as const;
  const favorable = favorableIncreasing ? difference > 0 : difference < 0;
  return favorable ? "improving" as const : "declining" as const;
}
