import type { ConfidenceAssessment } from "../../scoring";
import type { TrendId } from "./intelligence-id";
import type { IntelligenceExplainability } from "./intelligence-explainability";
import { date, text, validateBase } from "./artifact-support";

export type TrendDirection = "increasing" | "decreasing" | "stable";
export type TrendPoint = Readonly<{ at: Date; value: number }>;
export type TrendInput = Readonly<{ id: TrendId; title: string; summary: string; metric: string; direction: TrendDirection; points: readonly TrendPoint[]; confidence: ConfidenceAssessment; explainability: IntelligenceExplainability }>;
export class Trend {
  public readonly kind = "trend" as const; public readonly id: TrendId; public readonly title: string; public readonly summary: string;
  public readonly metric: string; public readonly direction: TrendDirection; public readonly points: readonly TrendPoint[];
  public readonly confidence: ConfidenceAssessment; public readonly explainability: IntelligenceExplainability;
  private constructor(input: TrendInput) { const base = validateBase(input); if (input.points.length < 2) throw new RangeError("A Trend requires at least two points."); this.id = input.id; this.title = base.title; this.summary = base.summary; this.metric = text(input.metric, "Trend metric"); this.direction = input.direction; this.points = Object.freeze(input.points.map((point) => { if (!Number.isFinite(point.value)) throw new TypeError("Trend values must be finite."); return Object.freeze({ at: date(point.at, "Trend point date"), value: point.value }); }).sort((a, b) => a.at.getTime() - b.at.getTime())); this.confidence = input.confidence; this.explainability = Object.freeze({ ...input.explainability, assumptions: base.assumptions, rationale: base.rationale }); Object.freeze(this); }
  public static create(input: TrendInput): Trend { return new Trend(input); }
  public get change(): number { return this.points[this.points.length - 1].value - this.points[0].value; }
}
