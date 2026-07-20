import type { ConfidenceAssessment } from "../../scoring";
import { text, validateBase } from "./artifact-support";
import type { LearningExplainability } from "./learning-explainability";
import type { ScoringImprovementId } from "./learning-id";

export type ScoringFactorChange = Readonly<{ factor: string; operation: "add" | "remove" | "reweight"; currentWeight?: number; proposedWeight?: number }>;
export type ScoringImprovementInput = Readonly<{ id: ScoringImprovementId; title: string; summary: string; targetModel: string; changes: readonly ScoringFactorChange[]; confidence: ConfidenceAssessment; explainability: LearningExplainability }>;
export class ScoringImprovement {
  public readonly kind = "scoring-improvement" as const; public readonly proposalStatus = "proposed" as const;
  public readonly id: ScoringImprovementId; public readonly title: string; public readonly summary: string; public readonly targetModel: string;
  public readonly changes: readonly ScoringFactorChange[]; public readonly confidence: ConfidenceAssessment; public readonly explainability: LearningExplainability;
  private constructor(input: ScoringImprovementInput) { const base = validateBase(input); if (input.changes.length === 0) throw new TypeError("Scoring improvement changes cannot be empty."); this.id = input.id; this.title = base.title; this.summary = base.summary; this.targetModel = text(input.targetModel, "Target scoring model"); this.changes = Object.freeze(input.changes.map((change) => { const factor = text(change.factor, "Scoring factor"); for (const value of [change.currentWeight, change.proposedWeight]) if (value !== undefined && !Number.isFinite(value)) throw new TypeError("Scoring weights must be finite."); if (change.operation === "reweight" && change.proposedWeight === undefined) throw new TypeError("A reweighted scoring factor requires a proposed weight."); return Object.freeze({ ...change, factor }); })); this.confidence = input.confidence; this.explainability = Object.freeze({ ...input.explainability, assumptions: base.assumptions, rationale: base.rationale }); Object.freeze(this); }
  public static create(input: ScoringImprovementInput): ScoringImprovement { return new ScoringImprovement(input); }
}
