import type { Evaluation, EvaluationCollection } from "../../evaluations";
import type { EvidenceId } from "../../evidence";
import type { ObservationId, ObservationValue } from "../../observations";
import type { ConfidenceAssessment } from "../../scoring";
import type { RecommendationPriority } from "../domain";

export type RecommendationPolicyContext = Readonly<{
  evaluations: EvaluationCollection;
}>;

export type RecommendationPolicyResult = Readonly<{
  summary: string;
  rationale: readonly string[];
  priority: RecommendationPriority;
  category: string;
  supportingEvaluations: readonly Evaluation[];
  supportingEvidence?: readonly EvidenceId[];
  supportingObservations?: readonly ObservationId[];
  confidence?: ConfidenceAssessment;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

/** Feature-owned reasoning contract for proposing an action. */
export interface RecommendationPolicy {
  readonly name: string;
  readonly version?: string;
  supports(context: RecommendationPolicyContext): boolean | Promise<boolean>;
  recommend(
    context: RecommendationPolicyContext,
  ): RecommendationPolicyResult | undefined | Promise<RecommendationPolicyResult | undefined>;
}
