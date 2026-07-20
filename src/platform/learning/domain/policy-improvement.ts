import type { ObservationValue } from "../../observations";
import type { ConfidenceAssessment } from "../../scoring";
import { numbers, text, validateBase } from "./artifact-support";
import type { LearningExplainability } from "./learning-explainability";
import type { PolicyImprovementId } from "./learning-id";

export type PolicyImprovementInput = Readonly<{ id: PolicyImprovementId; title: string; summary: string; targetPolicy: string; proposedChanges: Readonly<Record<string, ObservationValue>>; expectedImpact?: Readonly<Record<string, number>>; confidence: ConfidenceAssessment; explainability: LearningExplainability }>;
export class PolicyImprovement {
  public readonly kind = "policy-improvement" as const; public readonly proposalStatus = "proposed" as const;
  public readonly id: PolicyImprovementId; public readonly title: string; public readonly summary: string; public readonly targetPolicy: string;
  public readonly proposedChanges: Readonly<Record<string, ObservationValue>>; public readonly expectedImpact: Readonly<Record<string, number>>;
  public readonly confidence: ConfidenceAssessment; public readonly explainability: LearningExplainability;
  private constructor(input: PolicyImprovementInput) { const base = validateBase(input); if (Object.keys(input.proposedChanges).length === 0) throw new TypeError("Policy improvement changes cannot be empty."); this.id = input.id; this.title = base.title; this.summary = base.summary; this.targetPolicy = text(input.targetPolicy, "Target policy"); this.proposedChanges = Object.freeze({ ...input.proposedChanges }); this.expectedImpact = numbers(input.expectedImpact); this.confidence = input.confidence; this.explainability = Object.freeze({ ...input.explainability, assumptions: base.assumptions, rationale: base.rationale }); Object.freeze(this); }
  public static create(input: PolicyImprovementInput): PolicyImprovement { return new PolicyImprovement(input); }
}
