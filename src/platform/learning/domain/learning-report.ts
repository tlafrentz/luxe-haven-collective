import type { ObservationValue } from "../../observations";
import type { ConfidenceAssessment } from "../../scoring";
import { date, text } from "./artifact-support";
import type { ConfidenceCalibration } from "./confidence-calibration";
import type { LearningInsight } from "./learning-insight";
import type { LearningReportId } from "./learning-id";
import type { PolicyImprovement } from "./policy-improvement";
import type { ScoringImprovement } from "./scoring-improvement";

export type LearningArtifact = LearningInsight | PolicyImprovement | ScoringImprovement | ConfidenceCalibration;
export type LearningReportInput = Readonly<{ id: LearningReportId; reportingPeriod: Readonly<{ start: Date; end: Date }>; summary: string;
  insights?: readonly LearningInsight[]; policyImprovements?: readonly PolicyImprovement[]; scoringImprovements?: readonly ScoringImprovement[];
  confidenceCalibrations?: readonly ConfidenceCalibration[]; confidence: ConfidenceAssessment; metadata?: Readonly<Record<string, ObservationValue>> }>;
export class LearningReport {
  public readonly id: LearningReportId; public readonly reportingPeriod: Readonly<{ start: Date; end: Date }>; public readonly summary: string;
  public readonly insights: readonly LearningInsight[]; public readonly policyImprovements: readonly PolicyImprovement[];
  public readonly scoringImprovements: readonly ScoringImprovement[]; public readonly confidenceCalibrations: readonly ConfidenceCalibration[];
  public readonly confidence: ConfidenceAssessment; public readonly metadata: Readonly<Record<string, ObservationValue>>;
  private constructor(input: LearningReportInput) { const start = date(input.reportingPeriod.start, "Learning reporting period start"), end = date(input.reportingPeriod.end, "Learning reporting period end"); if (end < start) throw new RangeError("Learning reporting period end cannot precede its start."); const artifacts = [...(input.insights ?? []), ...(input.policyImprovements ?? []), ...(input.scoringImprovements ?? []), ...(input.confidenceCalibrations ?? [])]; const ids = artifacts.map((value) => value.id.value); if (new Set(ids).size !== ids.length) throw new RangeError("Learning artifact IDs must be unique within a report."); this.id = input.id; this.reportingPeriod = Object.freeze({ start, end }); this.summary = text(input.summary, "Learning report summary"); this.insights = Object.freeze([...(input.insights ?? [])]); this.policyImprovements = Object.freeze([...(input.policyImprovements ?? [])]); this.scoringImprovements = Object.freeze([...(input.scoringImprovements ?? [])]); this.confidenceCalibrations = Object.freeze([...(input.confidenceCalibrations ?? [])]); this.confidence = input.confidence; this.metadata = Object.freeze({ ...input.metadata }); Object.freeze(this); }
  public static create(input: LearningReportInput): LearningReport { return new LearningReport(input); }
  public get artifacts(): readonly LearningArtifact[] { return [...this.insights, ...this.policyImprovements, ...this.scoringImprovements, ...this.confidenceCalibrations]; }
  public get proposalCount(): number { return this.policyImprovements.length + this.scoringImprovements.length + this.confidenceCalibrations.length; }
}
