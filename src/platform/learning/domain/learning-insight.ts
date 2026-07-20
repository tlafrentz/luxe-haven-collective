import type { ConfidenceAssessment } from "../../scoring";
import { validateBase } from "./artifact-support";
import type { LearningExplainability } from "./learning-explainability";
import type { LearningInsightId } from "./learning-id";

export type LearningInsightType = "successful-pattern" | "unsuccessful-pattern" | "calibration" | "performance" | "other";
export type LearningInsightInput = Readonly<{ id: LearningInsightId; title: string; summary: string; type: LearningInsightType; confidence: ConfidenceAssessment; explainability: LearningExplainability }>;
export class LearningInsight {
  public readonly kind = "learning-insight" as const; public readonly id: LearningInsightId; public readonly title: string; public readonly summary: string;
  public readonly type: LearningInsightType; public readonly confidence: ConfidenceAssessment; public readonly explainability: LearningExplainability;
  private constructor(input: LearningInsightInput) { const base = validateBase(input); this.id = input.id; this.title = base.title; this.summary = base.summary; this.type = input.type; this.confidence = input.confidence; this.explainability = Object.freeze({ ...input.explainability, assumptions: base.assumptions, rationale: base.rationale }); Object.freeze(this); }
  public static create(input: LearningInsightInput): LearningInsight { return new LearningInsight(input); }
}
