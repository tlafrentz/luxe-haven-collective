import type { Identifier, Money, Percentage } from "@/platform/kernel";
import type { ConfidenceAssessment } from "@/platform/scoring";
import type {
  OutcomeAttribution, OutcomeEvidenceReference, OutcomeExpectationId, OutcomeId,
  OutcomeMeasurementId, OutcomeMetricDefinition, OutcomeOwnerId,
  OutcomeQualitativeObservationId, OutcomeQualitativeValue, OutcomeValue,
} from "../../outcomes";

export type DecisionOutcomeAssessmentId = Identifier<string>;
export type OutcomeClassification = "successful" | "partially-successful" | "unsuccessful" | "harmful" | "inconclusive";
export type ObjectiveStatus = "achieved" | "exceeded" | "missed" | "unknown" | "not-measured";
export type EvidenceSufficiency = "sufficient" | "limited" | "insufficient";
export type LearningReadiness = "ready" | "incomplete" | "insufficient-evidence" | "blocked" | "superseded";

export type OutcomeVariance =
  | Readonly<{ kind: "money"; absolute: Money; relativePercentage: number | null; currency: string; direction: "positive" | "negative" | "none" }>
  | Readonly<{ kind: "percentage"; absolutePercentagePoints: number; relativePercentage: number | null; direction: "positive" | "negative" | "none" }>
  | Readonly<{ kind: "ratio" | "count" | "duration"; absolute: number; relativePercentage: number | null; direction: "positive" | "negative" | "none"; unit?: string }>
  | Readonly<{ kind: "score"; absolute: number; relativePercentage: number | null; scale: Readonly<{ minimum: number; maximum: number }>; direction: "positive" | "negative" | "none" }>
  | Readonly<{ kind: "boolean" | "qualitative"; changed: boolean; direction: "positive" | "negative" | "none" }>;

export type ObjectiveAssessment = Readonly<{
  expectationId: OutcomeExpectationId;
  metric: OutcomeMetricDefinition;
  importance: "primary" | "secondary" | "guardrail";
  baseline: OutcomeValue | null;
  target: import("../../outcomes").OutcomeTarget;
  actual: OutcomeValue | null;
  measurementId: OutcomeMeasurementId | null;
  variance: OutcomeVariance | null;
  withinTolerance: boolean | null;
  status: ObjectiveStatus;
  confidence: ConfidenceAssessment;
  evidence: readonly OutcomeEvidenceReference[];
  reasonCode:
    | "TARGET_ACHIEVED" | "TARGET_EXCEEDED" | "TARGET_MISSED"
    | "NO_AUTHORITATIVE_MEASUREMENT" | "MISSING_BASELINE" | "INCOMPATIBLE_VALUE";
}>;

export type GuardrailSummary = Readonly<{
  total: number;
  preserved: number;
  violated: number;
  unknown: number;
  violatedExpectationIds: readonly OutcomeExpectationId[];
}>;
export type VarianceSummary = Readonly<{
  calculated: number;
  unavailable: number;
  favorable: number;
  unfavorable: number;
}>;
export type UnexpectedEffect = Readonly<{
  observationId: OutcomeQualitativeObservationId;
  disposition: "positive" | "neutral" | "negative";
  value: OutcomeQualitativeValue;
  confidence: ConfidenceAssessment;
  evidence: readonly OutcomeEvidenceReference[];
}>;
export type OutcomeHarmAssessment = Readonly<{
  detected: boolean;
  material: boolean;
  categories: readonly ("revenue-loss" | "guest-satisfaction-decline" | "capital-deterioration" | "operational-instability" | "compliance-impact" | "unexpected-negative")[];
  triggeringObservationIds: readonly OutcomeQualitativeObservationId[];
  overrideApplied: boolean;
}>;
export type OutcomeEvidenceSummary = Readonly<{
  sufficiency: EvidenceSufficiency;
  referenceCount: number;
  requiredCount: number;
  satisfiedRequiredCount: number;
  authoritativeMeasurementCount: number;
  limitationCount: number;
}>;
export type AssessmentConfidence = Readonly<{
  assessment: ConfidenceAssessment;
  measurementQuality: ConfidenceAssessment;
  evidenceQuality: ConfidenceAssessment;
  attributionQuality: ConfidenceAssessment;
  coverage: Percentage;
  freshnessScore: number;
  penalties: readonly Readonly<{ code: string; points: number }>[];
}>;
export type DecisionOutcomeAssessmentEvent = Readonly<{
  eventId: string;
  assessmentId: DecisionOutcomeAssessmentId;
  outcomeId: OutcomeId;
  ownerId: OutcomeOwnerId;
  assessmentVersion: number;
  occurredAt: Date;
  type: "DecisionOutcomeEvaluated" | "DecisionOutcomeReclassified" | "DecisionOutcomeReadyForLearning" | "DecisionOutcomeSuperseded";
  references: Readonly<Record<string, string | number | boolean>>;
}>;
export type DecisionOutcomeAssessment = Readonly<{
  id: DecisionOutcomeAssessmentId;
  ownerId: OutcomeOwnerId;
  outcomeId: OutcomeId;
  outcomeVersion: number;
  decisionReferences: readonly Readonly<{ decisionId: string; decisionVersion?: number }>[];
  classification: OutcomeClassification;
  objectives: readonly ObjectiveAssessment[];
  varianceSummary: VarianceSummary;
  guardrails: GuardrailSummary;
  unexpectedEffects: readonly UnexpectedEffect[];
  harm: OutcomeHarmAssessment;
  attribution: OutcomeAttribution;
  confidence: AssessmentConfidence;
  evidence: OutcomeEvidenceSummary;
  learningReadiness: LearningReadiness;
  policyVersion: string;
  evaluatedAt: Date;
  version: number;
  previousAssessmentId?: DecisionOutcomeAssessmentId;
  events: readonly DecisionOutcomeAssessmentEvent[];
}>;

export type DecisionOutcomePolicy = Readonly<{
  version: string;
  successfulPrimaryRatio: number;
  partialPrimaryRatio: number;
  guardrailPrecedence: "partial" | "unsuccessful" | "harmful";
  harmOverride: boolean;
  minimumConfidenceForConclusion: number;
  minimumConfidenceForLearning: number;
  minimumEvidenceCoverage: number;
  attributionRequiredForLearning: boolean;
  acceptedAttributionForLearning: readonly OutcomeAttribution["status"][];
  confidenceWeights: Readonly<{ measurement: number; evidence: number; attribution: number; coverage: number; freshness: number }>;
  materialHarm: Readonly<{
    unexpectedNegativeCount: number;
    categories: readonly import("../../outcomes").OutcomeQualitativeObservation["category"][];
  }>;
}>;
