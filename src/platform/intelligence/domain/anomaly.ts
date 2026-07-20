import type { ObservationValue } from "../../observations";
import type { ConfidenceAssessment } from "../../scoring";
import type { AnomalyId } from "./intelligence-id";
import type { IntelligenceExplainability } from "./intelligence-explainability";
import { text, validateBase } from "./artifact-support";

export type AnomalyInput = Readonly<{ id: AnomalyId; title: string; summary: string; expected: ObservationValue; actual: ObservationValue; deviation?: number; explanation: string; confidence: ConfidenceAssessment; explainability: IntelligenceExplainability }>;
export class Anomaly {
  public readonly kind = "anomaly" as const; public readonly id: AnomalyId; public readonly title: string; public readonly summary: string;
  public readonly expected: ObservationValue; public readonly actual: ObservationValue; public readonly deviation?: number; public readonly explanation: string;
  public readonly confidence: ConfidenceAssessment; public readonly explainability: IntelligenceExplainability;
  private constructor(input: AnomalyInput) { const base = validateBase(input); if (input.deviation !== undefined && !Number.isFinite(input.deviation)) throw new TypeError("Anomaly deviation must be finite."); this.id = input.id; this.title = base.title; this.summary = base.summary; this.expected = input.expected; this.actual = input.actual; this.deviation = input.deviation; this.explanation = text(input.explanation, "Anomaly explanation"); this.confidence = input.confidence; this.explainability = Object.freeze({ ...input.explainability, assumptions: base.assumptions, rationale: base.rationale }); Object.freeze(this); }
  public static create(input: AnomalyInput): Anomaly { return new Anomaly(input); }
}
