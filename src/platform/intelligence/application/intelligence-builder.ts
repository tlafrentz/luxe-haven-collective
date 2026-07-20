import type { Identifier } from "../../kernel";
import type { ObservationValue } from "../../observations";
import { emptyOutcomeLineage, normalizeOutcomeLineage, type Outcome, type OutcomeLineage } from "../../outcomes";
import { ConfidenceAssessment, ConfidenceScore } from "../../scoring";
import {
  Anomaly, createAnomalyId, createForecastId, createInsightId, createIntelligenceReportId, createOpportunityId, createTrendId,
  Forecast, Insight, IntelligenceReport, Opportunity, Trend, type IntelligenceExplainability, type IntelligenceReportId,
} from "../domain";
import type { IntelligencePolicyResult } from "./intelligence-policy";

export type IntelligenceBuilderInput = Readonly<{ result: IntelligencePolicyResult; id?: IntelligenceReportId; metadata?: Readonly<Record<string, ObservationValue>> }>;
export class IntelligenceBuilder {
  public build(input: IntelligenceBuilderInput): IntelligenceReport {
    const insights = (input.result.insights ?? []).map((result) => Insight.create({ id: result.id ?? createInsightId(), ...result, explainability: explainability(result) }));
    const trends = (input.result.trends ?? []).map((result) => Trend.create({ id: result.id ?? createTrendId(), ...result, explainability: explainability(result) }));
    const opportunities = (input.result.opportunities ?? []).map((result) => Opportunity.create({ id: result.id ?? createOpportunityId(), ...result, explainability: explainability(result) }));
    const forecasts = (input.result.forecasts ?? []).map((result) => Forecast.create({ id: result.id ?? createForecastId(), ...result, explainability: explainability(result) }));
    const anomalies = (input.result.anomalies ?? []).map((result) => Anomaly.create({ id: result.id ?? createAnomalyId(), ...result, explainability: explainability(result) }));
    const artifacts = [...insights, ...trends, ...opportunities, ...forecasts, ...anomalies];
    const confidence = input.result.confidence ?? inheritedConfidence(artifacts.map((artifact) => artifact.confidence));
    return IntelligenceReport.create({ id: input.id ?? createIntelligenceReportId(), title: input.result.title, summary: input.result.summary,
      reportingPeriod: input.result.reportingPeriod, insights, trends, opportunities, forecasts, anomalies, confidence,
      metadata: { ...input.result.metadata, ...input.metadata },
    });
  }
}
function explainability(result: { supportingOutcomes: readonly Outcome[]; assumptions?: readonly string[]; rationale: readonly string[] }): IntelligenceExplainability {
  if (result.supportingOutcomes.length === 0) throw new TypeError("Intelligence supporting Outcomes cannot be empty.");
  return Object.freeze({ supportingOutcomeIds: unique(result.supportingOutcomes.map((outcome) => outcome.id)),
    lineage: mergeLineage(result.supportingOutcomes.map((outcome) => outcome.lineage)), assumptions: Object.freeze([...(result.assumptions ?? [])]), rationale: Object.freeze([...result.rationale]),
  });
}
function mergeLineage(values: readonly OutcomeLineage[]): OutcomeLineage {
  const empty = emptyOutcomeLineage();
  const merged = Object.fromEntries(
    (Object.keys(empty) as (keyof OutcomeLineage)[])
      .map((key) => [key, values.flatMap((value) => value[key])]),
  ) as unknown as OutcomeLineage;
  return normalizeOutcomeLineage(merged);
}
function unique<T extends Identifier>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Map(values.map((value) => [value.value, value])).values()]);
}
function inheritedConfidence(values: readonly ConfidenceAssessment[]): ConfidenceAssessment {
  if (values.length === 0) throw new TypeError("Intelligence report confidence is required when the report has no artifacts.");
  const score = Math.min(...values.map((value) => value.score.value));
  return ConfidenceAssessment.create({ score: ConfidenceScore.create(score), rationale: ["Inherited from the least-confident report artifact."] });
}
