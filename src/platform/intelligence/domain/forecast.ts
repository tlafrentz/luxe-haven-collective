import type { ObservationValue } from "../../observations";
import type { ConfidenceAssessment } from "../../scoring";
import type { ForecastId } from "./intelligence-id";
import type { IntelligenceExplainability } from "./intelligence-explainability";
import { date, validateBase } from "./artifact-support";

export type ForecastInput = Readonly<{ id: ForecastId; title: string; summary: string; prediction: ObservationValue; horizon: Readonly<{ start: Date; end: Date }>; confidence: ConfidenceAssessment; supportingIntelligenceIds?: readonly { value: string }[]; explainability: IntelligenceExplainability }>;
export class Forecast {
  public readonly kind = "forecast" as const; public readonly id: ForecastId; public readonly title: string; public readonly summary: string;
  public readonly prediction: ObservationValue; public readonly horizon: Readonly<{ start: Date; end: Date }>;
  public readonly confidence: ConfidenceAssessment; public readonly supportingIntelligenceIds: readonly { value: string }[]; public readonly explainability: IntelligenceExplainability;
  private constructor(input: ForecastInput) { const base = validateBase(input); if (base.assumptions.length === 0) throw new TypeError("Forecast assumptions cannot be empty."); const start = date(input.horizon.start, "Forecast horizon start"), end = date(input.horizon.end, "Forecast horizon end"); if (end <= start) throw new RangeError("Forecast horizon end must follow its start."); this.id = input.id; this.title = base.title; this.summary = base.summary; this.prediction = input.prediction; this.horizon = Object.freeze({ start, end }); this.confidence = input.confidence; this.supportingIntelligenceIds = Object.freeze([...(input.supportingIntelligenceIds ?? [])]); this.explainability = Object.freeze({ ...input.explainability, assumptions: base.assumptions, rationale: base.rationale }); Object.freeze(this); }
  public static create(input: ForecastInput): Forecast { return new Forecast(input); }
}
