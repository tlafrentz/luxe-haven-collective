import type { ConfidenceAssessment } from "../../scoring";
import type { OpportunityId } from "./intelligence-id";
import type { IntelligenceExplainability } from "./intelligence-explainability";
import { numbers, validateBase } from "./artifact-support";

export type OpportunityInput = Readonly<{ id: OpportunityId; title: string; summary: string; confidence: ConfidenceAssessment; expectedImpact: Readonly<Record<string, number>>; explainability: IntelligenceExplainability }>;
export class Opportunity {
  public readonly kind = "opportunity" as const; public readonly id: OpportunityId; public readonly title: string; public readonly summary: string;
  public readonly confidence: ConfidenceAssessment; public readonly expectedImpact: Readonly<Record<string, number>>; public readonly explainability: IntelligenceExplainability;
  private constructor(input: OpportunityInput) { const base = validateBase(input); this.id = input.id; this.title = base.title; this.summary = base.summary; this.confidence = input.confidence; this.expectedImpact = numbers(input.expectedImpact); this.explainability = Object.freeze({ ...input.explainability, assumptions: base.assumptions, rationale: base.rationale }); Object.freeze(this); }
  public static create(input: OpportunityInput): Opportunity { return new Opportunity(input); }
}
