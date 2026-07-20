import type { ConfidenceAssessment } from "../../scoring";
import type { LearningExplainability } from "./learning-explainability";

export type LearningArtifactBaseInput<TId> = Readonly<{ id: TId; title: string; summary: string; confidence: ConfidenceAssessment; explainability: LearningExplainability }>;
export function validateBase<TId>(input: LearningArtifactBaseInput<TId>) {
  if (input.explainability.supportingOutcomeIds.length === 0) throw new TypeError("Learning supporting Outcomes cannot be empty.");
  if (input.explainability.supportingIntelligenceIds.length === 0) throw new TypeError("Learning supporting Intelligence cannot be empty.");
  if (input.explainability.rationale.length === 0) throw new TypeError("Learning rationale cannot be empty.");
  const assumptions = strings(input.explainability.assumptions);
  if (assumptions.length === 0) throw new TypeError("Learning assumptions cannot be empty.");
  return { title: text(input.title, "Learning title"), summary: text(input.summary, "Learning summary"), assumptions, rationale: strings(input.explainability.rationale) };
}
export function text(value: string, field: string): string { const normalized = value.trim(); if (!normalized) throw new TypeError(`${field} cannot be empty.`); return normalized; }
export function strings(values: readonly string[]): readonly string[] { return Object.freeze([...new Set(values.map((value) => value.trim()).filter(Boolean))]); }
export function numbers(value: Readonly<Record<string, number>> = {}): Readonly<Record<string, number>> { const result: Record<string, number> = {}; for (const [key, entry] of Object.entries(value)) { if (!Number.isFinite(entry)) throw new TypeError(`Learning metric "${key}" must be finite.`); result[text(key, "Learning metric name")] = entry; } return Object.freeze(result); }
export function date(value: Date, field: string): Date { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new TypeError(`${field} must be valid.`); return result; }
