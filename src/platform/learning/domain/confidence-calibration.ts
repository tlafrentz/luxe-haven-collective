import { ConfidenceScore, type ConfidenceAssessment } from "../../scoring";
import { validateBase } from "./artifact-support";
import type { LearningExplainability } from "./learning-explainability";
import type { ConfidenceCalibrationId } from "./learning-id";

export type ConfidenceCalibrationInput = Readonly<{ id: ConfidenceCalibrationId; title: string; summary: string; estimatedConfidence: ConfidenceScore; observedAccuracy: ConfidenceScore; recommendedConfidence: ConfidenceScore; sampleSize: number; confidence: ConfidenceAssessment; explainability: LearningExplainability }>;
export class ConfidenceCalibration {
  public readonly kind = "confidence-calibration" as const; public readonly proposalStatus = "proposed" as const;
  public readonly id: ConfidenceCalibrationId; public readonly title: string; public readonly summary: string;
  public readonly estimatedConfidence: ConfidenceScore; public readonly observedAccuracy: ConfidenceScore; public readonly recommendedConfidence: ConfidenceScore;
  public readonly sampleSize: number; public readonly confidence: ConfidenceAssessment; public readonly explainability: LearningExplainability;
  private constructor(input: ConfidenceCalibrationInput) { const base = validateBase(input); if (!Number.isSafeInteger(input.sampleSize) || input.sampleSize < 1) throw new RangeError("Confidence calibration sample size must be a positive integer."); this.id = input.id; this.title = base.title; this.summary = base.summary; this.estimatedConfidence = input.estimatedConfidence; this.observedAccuracy = input.observedAccuracy; this.recommendedConfidence = input.recommendedConfidence; this.sampleSize = input.sampleSize; this.confidence = input.confidence; this.explainability = Object.freeze({ ...input.explainability, assumptions: base.assumptions, rationale: base.rationale }); Object.freeze(this); }
  public static create(input: ConfidenceCalibrationInput): ConfidenceCalibration { return new ConfidenceCalibration(input); }
  public get adjustment(): number { return this.recommendedConfidence.value - this.estimatedConfidence.value; }
}
