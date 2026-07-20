import type { ClaimCollection } from "@/platform/claims";
import type { EvaluationCollection } from "@/platform/evaluations";
import type { EvidenceCollection } from "@/platform/evidence";
import type { IntelligenceReport } from "@/platform/intelligence";
import type { ObservationCollection } from "@/platform/observations";
import type { RecommendationCollection } from "@/platform/recommendations";

export type CanonicalInvestmentUpstream = Readonly<{
  observations: ObservationCollection;
  evidence: EvidenceCollection;
  claims: ClaimCollection;
  evaluations: EvaluationCollection;
  recommendations: RecommendationCollection;
  intelligence?: IntelligenceReport;
}>;

export type InvestmentUpstreamInputs = Readonly<{
  market?: CanonicalInvestmentUpstream;
  revenue?: CanonicalInvestmentUpstream;
}>;

export type NormalizedInvestmentUpstream = Readonly<{
  marketObservationIds: readonly string[];
  revenueObservationIds: readonly string[];
  evidenceIds: readonly string[];
  recommendationIds: readonly string[];
  intelligenceReportIds: readonly string[];
}>;

/** Feature boundary: Investment consumes canonical artifacts, never Market/Revenue report DTOs. */
export function normalizeInvestmentUpstream(input: InvestmentUpstreamInputs): NormalizedInvestmentUpstream {
  const sources = [input.market, input.revenue].filter((value): value is CanonicalInvestmentUpstream => Boolean(value));
  return Object.freeze({
    marketObservationIds: ids(input.market?.observations.toArray()),
    revenueObservationIds: ids(input.revenue?.observations.toArray()),
    evidenceIds: sources.flatMap((source) => ids(source.evidence.toArray())),
    recommendationIds: sources.flatMap((source) => ids(source.recommendations.toArray())),
    intelligenceReportIds: sources.flatMap((source) => source.intelligence ? [source.intelligence.id.value] : []),
  });
}

function ids(values: readonly { id: { value: string } }[] | undefined): readonly string[] {
  return Object.freeze((values ?? []).map((value) => value.id.value));
}
