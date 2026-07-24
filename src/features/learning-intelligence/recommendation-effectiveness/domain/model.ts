import type { Identifier, Percentage } from "@/platform/kernel";
import type { ConfidenceAssessment, Score } from "@/platform/scoring";
import type { DecisionOutcomeAssessment, DecisionOutcomeAssessmentId, OutcomeClassification } from "../../decision-outcomes";
import type { OutcomeId, OutcomeOwnerId, OutcomeStatus } from "../../outcomes";

export type RecommendationTypeId = Identifier<string>;
export type RecommendationEffectivenessAssessmentId = Identifier<string>;
export type RecommendationEffectiveness =
  | "highly-effective" | "effective" | "mixed" | "ineffective" | "harmful" | "insufficient-evidence";
export type RecommendationQuality =
  | "validated" | "promising" | "conditional" | "experimental" | "deprecated" | "insufficient-evidence";
export type RecommendationLearningReadiness = "ready" | "limited" | "insufficient-evidence" | "blocked";
export type RecommendationApplicabilityCondition = Readonly<{
  category: "property-type" | "market" | "portfolio-stage" | "seasonality" | "operating-model";
  value: string;
}>;
export type RecommendationInstance = Readonly<{
  recommendationId: string;
  recommendationType: RecommendationTypeId;
  decisionId: string;
  executionReferences: readonly string[];
  outcomeId: OutcomeId;
  outcomeAssessmentId: DecisionOutcomeAssessmentId;
  outcomeStatus: OutcomeStatus;
  applicability: readonly RecommendationApplicabilityCondition[];
  assessedAt: Date;
  assessment: DecisionOutcomeAssessment;
}>;
export type RecommendationOutcomeDistribution = Readonly<{
  successful: number;
  partiallySuccessful: number;
  unsuccessful: number;
  harmful: number;
  inconclusive: number;
  totalEvaluated: number;
}>;
export type RecommendationSuccessMetrics = Readonly<{
  successRate: Percentage | null;
  partialSuccessRate: Percentage | null;
  failureRate: Percentage | null;
  harmRate: Percentage | null;
  inconclusiveRate: Percentage | null;
}>;
export type RecommendationSampleAssessment = Readonly<{
  outcomeCount: number;
  conclusiveOutcomeCount: number;
  minimumRequired: number;
  sufficient: boolean;
  confidencePenalty: Percentage;
}>;
export type RecommendationRepeatabilityLimitation =
  | "SMALL_SAMPLE" | "HIGH_INCONCLUSIVE_RATE" | "MIXED_RESULTS"
  | "LOW_ATTRIBUTION" | "INCOMPARABLE_CONDITIONS";
export type RecommendationRepeatabilityAssessment = Readonly<{
  classification: "high" | "moderate" | "low" | "unknown";
  comparableOutcomeCount: number;
  consistencyScore: Score | null;
  confidence: ConfidenceAssessment;
  limitingFactors: readonly RecommendationRepeatabilityLimitation[];
}>;
export type RecommendationEvidenceSummary = Readonly<{
  evaluatedOutcomeCount: number;
  evidenceCoverage: Percentage;
  attributionQuality: ConfidenceAssessment;
  outcomeConfidence: ConfidenceAssessment;
  missingEvidenceCount: number;
}>;
export type RecommendationEffectivenessConfidence = Readonly<{
  assessment: ConfidenceAssessment;
  sampleQuality: ConfidenceAssessment;
  evidenceQuality: ConfidenceAssessment;
  outcomeQuality: ConfidenceAssessment;
  penalties: readonly Readonly<{ code: string; points: number }>[];
}>;
export type RecommendationHarmSummary = Readonly<{
  harmfulOutcomeCount: number;
  guardrailViolationRate: Percentage | null;
  unexpectedNegativeRate: Percentage | null;
  severeHarmObserved: boolean;
}>;
export type RecommendationTrendAssessment = Readonly<{
  direction: "improving" | "stable" | "declining" | "unknown";
  comparableAssessment: boolean;
  changes: readonly Readonly<{ metric: "effectiveness" | "success-rate" | "harm-rate" | "confidence" | "sample-size"; previous: string | number | null; current: string | number | null } >[];
}>;
export type RecommendationConditionPerformance = Readonly<{
  condition: RecommendationApplicabilityCondition;
  outcomeCount: number;
  beneficialCount: number;
  harmfulCount: number;
}>;
export type RecommendationEffectivenessLineage = Readonly<{
  recommendationIds: readonly string[];
  decisionIds: readonly string[];
  outcomeIds: readonly OutcomeId[];
  outcomeAssessmentIds: readonly DecisionOutcomeAssessmentId[];
  previousAssessmentId?: RecommendationEffectivenessAssessmentId;
}>;
export type RecommendationEffectivenessAssessment = Readonly<{
  id: RecommendationEffectivenessAssessmentId;
  ownerId: OutcomeOwnerId;
  recommendationType: RecommendationTypeId;
  policyVersion: string;
  evaluatedAt: Date;
  version: number;
  overall: Readonly<{
    effectiveness: RecommendationEffectiveness;
    quality: RecommendationQuality;
    metrics: RecommendationSuccessMetrics;
    sample: RecommendationSampleAssessment;
  }>;
  outcomeDistribution: RecommendationOutcomeDistribution;
  repeatability: RecommendationRepeatabilityAssessment;
  confidence: RecommendationEffectivenessConfidence;
  trends: RecommendationTrendAssessment;
  evidence: RecommendationEvidenceSummary;
  harm: RecommendationHarmSummary;
  applicability: readonly RecommendationConditionPerformance[];
  learningReadiness: RecommendationLearningReadiness;
  lineage: RecommendationEffectivenessLineage;
}>;
export type RecommendationEffectivenessPolicy = Readonly<{
  version: string;
  minimumSampleSize: number;
  highlyEffectiveSuccessRate: number;
  effectiveSuccessRate: number;
  mixedSuccessRate: number;
  harmfulRateThreshold: number;
  severeHarmOverrides: boolean;
  highRepeatabilityRate: number;
  moderateRepeatabilityRate: number;
  minimumConfidenceForLearning: number;
  maximumInconclusiveRateForLearning: number;
  trendStableTolerancePoints: number;
  confidenceWeights: Readonly<{ sample: number; evidence: number; outcome: number; attribution: number; consistency: number }>;
}>;

export type EligibleRecommendationAssessment = DecisionOutcomeAssessment & Readonly<{ classification: OutcomeClassification }>;
