import type { ConfidenceAssessment } from "../../scoring";
import type { IntelligenceExplainability } from "./intelligence-explainability";

export type IntelligenceArtifactBaseInput<TId> = Readonly<{
  id: TId;
  title: string;
  summary: string;
  confidence: ConfidenceAssessment;
  explainability: IntelligenceExplainability;
}>;
export function validateBase<TId>(input: IntelligenceArtifactBaseInput<TId>) {
  if (input.explainability.supportingOutcomeIds.length === 0) throw new TypeError("Intelligence supporting Outcomes cannot be empty.");
  if (input.explainability.lineage.actionIds.length === 0) throw new TypeError("Intelligence supporting Actions cannot be empty.");
  if (input.explainability.lineage.decisionIds.length === 0) throw new TypeError("Intelligence supporting Decisions cannot be empty.");
  if (input.explainability.rationale.length === 0) throw new TypeError("Intelligence rationale cannot be empty.");
  return {
    title: text(input.title, "Intelligence title"), summary: text(input.summary, "Intelligence summary"),
    assumptions: strings(input.explainability.assumptions), rationale: strings(input.explainability.rationale),
  };
}
export function numbers(value: Readonly<Record<string, number>> = {}): Readonly<Record<string, number>> {
  const output: Record<string, number> = {};
  for (const [key, entry] of Object.entries(value)) { if (!Number.isFinite(entry)) throw new TypeError(`Intelligence metric "${key}" must be finite.`); output[text(key, "Intelligence metric name")] = entry; }
  return Object.freeze(output);
}
export function strings(values: readonly string[]): readonly string[] { return Object.freeze([...new Set(values.map((value) => value.trim()).filter(Boolean))]); }
export function text(value: string, field: string): string { const normalized = value.trim(); if (!normalized) throw new TypeError(`${field} cannot be empty.`); return normalized; }
export function date(value: Date, field: string): Date { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new TypeError(`${field} must be valid.`); return result; }
