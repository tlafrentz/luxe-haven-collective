import type { ObservationValue } from "../../observations";
import type {
  Recommendation,
  RecommendationCollection,
  RecommendationPriority,
} from "../../recommendations";
import type { ConfidenceAssessment } from "../../scoring";
import { DecisionMode } from "../domain/decision-mode";

export type DecisionPolicyContext = Readonly<{
  recommendations: RecommendationCollection;
}>;

export type DecisionPolicyResult = Readonly<{
  title: string;
  summary: string;
  rationale: readonly string[];
  category: string;
  mode: DecisionMode;
  selectedRecommendations: readonly Recommendation[];
  priority?: RecommendationPriority;
  confidence?: ConfidenceAssessment;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

export interface DecisionPolicy {
  readonly name: string;
  readonly version?: string;
  supports(context: DecisionPolicyContext): boolean | Promise<boolean>;
  decide(
    context: DecisionPolicyContext,
  ): DecisionPolicyResult | undefined | Promise<DecisionPolicyResult | undefined>;
}
