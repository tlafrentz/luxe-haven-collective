import type { ConfidenceAssessment } from "../../scoring";
import type { InsightId } from "./intelligence-id";
import type { IntelligenceExplainability } from "./intelligence-explainability";
import { numbers, validateBase } from "./artifact-support";

export type InsightInput = Readonly<{ id: InsightId; title: string; summary: string; confidence: ConfidenceAssessment; businessImpact?: Readonly<Record<string, number>>; explainability: IntelligenceExplainability }>;
export class Insight {
  public readonly kind = "insight" as const;
  public readonly id: InsightId; public readonly title: string; public readonly summary: string;
  public readonly confidence: ConfidenceAssessment; public readonly businessImpact: Readonly<Record<string, number>>;
  public readonly explainability: IntelligenceExplainability;
  private constructor(input: InsightInput) { const base = validateBase(input); this.id = input.id; this.title = base.title; this.summary = base.summary; this.confidence = input.confidence; this.businessImpact = numbers(input.businessImpact); this.explainability = Object.freeze({ ...input.explainability, assumptions: base.assumptions, rationale: base.rationale }); Object.freeze(this); }
  public static create(input: InsightInput): Insight { return new Insight(input); }
}
