import type { Identifier } from "../../kernel";
import type { ObservationValue } from "../../observations";
import { emptyOutcomeLineage, normalizeOutcomeLineage, type OutcomeLineage } from "../../outcomes";
import { ConfidenceAssessment, ConfidenceScore } from "../../scoring";
import { ConfidenceCalibration, createConfidenceCalibrationId, createLearningInsightId, createLearningReportId, createPolicyImprovementId, createScoringImprovementId, LearningInsight, LearningReport, PolicyImprovement, ScoringImprovement, type LearningExplainability, type LearningReportId } from "../domain";
import type { LearningPolicyResult } from "./learning-policy";

export type LearningBuilderInput = Readonly<{ result: LearningPolicyResult; id?: LearningReportId; metadata?: Readonly<Record<string, ObservationValue>> }>;
export class LearningBuilder {
  public build(input: LearningBuilderInput): LearningReport {
    const insights = (input.result.insights ?? []).map((result) => LearningInsight.create({ id: result.id ?? createLearningInsightId(), ...result, explainability: explainability(result) }));
    const policyImprovements = (input.result.policyImprovements ?? []).map((result) => PolicyImprovement.create({ id: result.id ?? createPolicyImprovementId(), ...result, explainability: explainability(result) }));
    const scoringImprovements = (input.result.scoringImprovements ?? []).map((result) => ScoringImprovement.create({ id: result.id ?? createScoringImprovementId(), ...result, explainability: explainability(result) }));
    const confidenceCalibrations = (input.result.confidenceCalibrations ?? []).map((result) => ConfidenceCalibration.create({ id: result.id ?? createConfidenceCalibrationId(), ...result, explainability: explainability(result) }));
    const artifacts = [...insights, ...policyImprovements, ...scoringImprovements, ...confidenceCalibrations];
    return LearningReport.create({ id: input.id ?? createLearningReportId(), reportingPeriod: input.result.reportingPeriod, summary: input.result.summary,
      insights, policyImprovements, scoringImprovements, confidenceCalibrations,
      confidence: input.result.confidence ?? inheritedConfidence(artifacts.map((artifact) => artifact.confidence)), metadata: { ...input.result.metadata, ...input.metadata },
    });
  }
}
function explainability(result: { supportingOutcomes: readonly import("../../outcomes").Outcome[]; supportingIntelligence: readonly import("../../intelligence").IntelligenceReport[]; assumptions?: readonly string[]; rationale: readonly string[] }): LearningExplainability {
  if (result.supportingOutcomes.length === 0) throw new TypeError("Learning supporting Outcomes cannot be empty.");
  if (result.supportingIntelligence.length === 0) throw new TypeError("Learning supporting Intelligence cannot be empty.");
  const outcomeLineage = result.supportingOutcomes.map((value) => value.lineage);
  const intelligenceLineage = result.supportingIntelligence.flatMap((report) => report.artifacts.map((artifact) => artifact.explainability.lineage));
  return Object.freeze({ supportingOutcomeIds: unique(result.supportingOutcomes.map((value) => value.id)), supportingIntelligenceIds: unique(result.supportingIntelligence.map((value) => value.id)),
    lineage: mergeLineage([...outcomeLineage, ...intelligenceLineage]), assumptions: Object.freeze([...(result.assumptions ?? [])]), rationale: Object.freeze([...result.rationale]),
  });
}
function mergeLineage(values: readonly OutcomeLineage[]): OutcomeLineage { const empty = emptyOutcomeLineage(); const merged = Object.fromEntries((Object.keys(empty) as (keyof OutcomeLineage)[]).map((key) => [key, values.flatMap((value) => value[key])])) as unknown as OutcomeLineage; return normalizeOutcomeLineage(merged); }
function unique<T extends Identifier>(values: readonly T[]): readonly T[] { return Object.freeze([...new Map(values.map((value) => [value.value, value])).values()]); }
function inheritedConfidence(values: readonly ConfidenceAssessment[]): ConfidenceAssessment { if (values.length === 0) throw new TypeError("Learning report confidence is required when the report has no artifacts."); const score = Math.min(...values.map((value) => value.score.value)); return ConfidenceAssessment.create({ score: ConfidenceScore.create(score), rationale: ["Inherited from the least-confident learning artifact."] }); }
