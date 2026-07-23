import {
  calculateWeightedScore,
  Score,
  ScoreScale,
  Weight,
  WeightedScore,
} from "@/platform/scoring";

import {
  OPPORTUNITY_COMPARISON_RANKING_POLICY,
  type OpportunityComparisonCandidate,
  type OpportunityComparisonRank,
} from "./comparison-types";

export function rankOpportunities(
  candidates: readonly OpportunityComparisonCandidate[],
): readonly OpportunityComparisonRank[] {
  const cashFlows = candidates.map((value) => metric(value, "annualCashFlow"));
  const returns = candidates.map((value) => metric(value, "cashOnCashReturn"));
  const efficiencies = candidates.map(
    (value) =>
      metric(value, "annualCashFlow") /
      Math.max(metric(value, "initialCashRequired"), 1),
  );

  const ranked = candidates
    .map((candidate, index) => {
      const score = candidate.score / 100;
      const confidence = confidenceValue(candidate.confidence);
      const risk =
        1 -
        Math.min(
          candidate.risks.reduce(
            (sum, item) => sum + severity(item.severity),
            0,
          ) / 12,
          1,
        );
      const completeness = 1 - Math.min(candidate.dataGaps.length / 6, 1);
      const factors = {
        investmentScore: score,
        confidence,
        cashOnCashReturn: normalize(returns[index], returns),
        annualCashFlow: normalize(cashFlows[index], cashFlows),
        capitalEfficiency: normalize(efficiencies[index], efficiencies),
        riskBurden: risk,
        dataCompleteness: completeness,
      };
      const weights = OPPORTUNITY_COMPARISON_RANKING_POLICY.weights;
      const composite = calculateWeightedScore(
        Object.entries(factors).map(([key, value]) =>
          WeightedScore.create(
            Score.create(value, ScoreScale.ZERO_TO_ONE),
            Weight.create(weights[key as keyof typeof weights]),
          ),
        ),
      ).value;
      const strengths = [
        score >= Math.max(...candidates.map((value) => value.score / 100))
          ? "Highest canonical Investment Score"
          : null,
        returns[index] === Math.max(...returns)
          ? "Strongest cash-on-cash return"
          : null,
        efficiencies[index] === Math.max(...efficiencies)
          ? "Best projected capital efficiency"
          : null,
        candidate.dataGaps.length ===
        Math.min(...candidates.map((value) => value.dataGaps.length))
          ? "Fewest unresolved data gaps"
          : null,
      ].filter((value): value is string => Boolean(value));
      const tradeoffs = [
        confidence < 0.6 ? "Lower-confidence analysis" : null,
        candidate.risks.some((item) => severity(item.severity) >= 3)
          ? "Material risk requires review"
          : null,
        candidate.dataGaps.length > 0
          ? `${candidate.dataGaps.length} unresolved data gap${candidate.dataGaps.length === 1 ? "" : "s"}`
          : null,
        metric(candidate, "initialCashRequired") ===
        Math.max(
          ...candidates.map((value) => metric(value, "initialCashRequired")),
        )
          ? "Highest initial capital requirement"
          : null,
      ].filter((value): value is string => Boolean(value));

      return { candidate, composite, strengths, tradeoffs };
    })
    .sort(
      (a, b) =>
        b.composite - a.composite ||
        b.candidate.score - a.candidate.score ||
        a.candidate.id.localeCompare(b.candidate.id),
    );

  return Object.freeze(
    ranked.map((item, index) =>
      Object.freeze({
        opportunityId: item.candidate.id,
        rank: index + 1,
        compositeScore: Math.round(item.composite * 1000) / 10,
        summary:
          index === 0
            ? "Strongest overall under the published comparison policy."
            : "Ranks behind another candidate after confidence, returns, capital efficiency, risk, and data completeness adjustments.",
        strengths: Object.freeze(item.strengths),
        tradeoffs: Object.freeze(item.tradeoffs),
      }),
    ),
  );
}

function metric(value: OpportunityComparisonCandidate, key: string): number {
  return value.metrics[key]?.value ?? 0;
}

function normalize(value: number, values: readonly number[]): number {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max === min ? 1 : (value - min) / (max - min);
}

function confidenceValue(value: string): number {
  return (
    {
      "very-high": 1,
      high: 0.85,
      moderate: 0.65,
      medium: 0.65,
      low: 0.4,
      "very-low": 0.2,
      none: 0,
    } as Record<string, number>
  )[value] ?? 0.5;
}

function severity(value: string): number {
  return (
    { critical: 4, high: 3, medium: 2, moderate: 2, low: 1 } as Record<
      string,
      number
    >
  )[value.toLowerCase()] ?? 1;
}
