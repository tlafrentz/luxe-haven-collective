import type { Evaluation } from "../../evaluations";
import type { ObservationValue } from "../../observations";
import type { RecommendationId } from "../domain";
import { Recommendation } from "../domain";
import type { RecommendationPolicyResult } from "./recommendation-policy";

export type RecommendationBuilderInput = Readonly<{
  result: RecommendationPolicyResult;
  id?: RecommendationId;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

/** Validates and constructs canonical Recommendations from policy output. */
export class RecommendationBuilder {
  public build(input: RecommendationBuilderInput): Recommendation {
    const supportingEvaluations = uniqueEvaluations(input.result.supportingEvaluations);
    const confidence = input.result.confidence ?? inheritedConfidence(supportingEvaluations);
    const evidenceIds = input.result.supportingEvidence ?? supportingEvaluations.flatMap(
      (evaluation) => evaluation.evidenceIds,
    );

    return Recommendation.create({
      ...(input.id ? { id: input.id } : {}),
      summary: input.result.summary,
      rationale: input.result.rationale,
      priority: input.result.priority,
      category: input.result.category,
      confidence,
      evaluationIds: supportingEvaluations.map((evaluation) => evaluation.id),
      evidenceIds,
      claimIds: supportingEvaluations.map((evaluation) => evaluation.claimId),
      observationIds: input.result.supportingObservations,
      metadata: { ...input.result.metadata, ...input.metadata },
    });
  }
}

function uniqueEvaluations(values: readonly Evaluation[]): readonly Evaluation[] {
  if (values.length === 0) {
    throw new TypeError("Recommendation supporting Evaluations cannot be empty.");
  }
  const byId = new Map(values.map((value) => [value.id.value, value]));
  return [...byId.values()];
}

function inheritedConfidence(values: readonly Evaluation[]) {
  if (values.length !== 1) {
    throw new TypeError(
      "Recommendation confidence is required when multiple Evaluations support it.",
    );
  }
  return values[0].confidence;
}
