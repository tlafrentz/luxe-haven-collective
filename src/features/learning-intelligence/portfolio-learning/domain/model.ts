import type { Identifier, Money, Percentage } from "@/platform/kernel";
import type { ConfidenceAssessment, Score } from "@/platform/scoring";
import type {
  DecisionOutcomeAssessment, DecisionOutcomeAssessmentId, OutcomeClassification, OutcomeVariance,
} from "../../decision-outcomes";
import type {
  RecommendationEffectiveness, RecommendationEffectivenessAssessment,
  RecommendationEffectivenessAssessmentId, RecommendationTypeId,
} from "../../recommendation-effectiveness";
import type { OutcomeMetricKey, OutcomeOwnerId, OutcomeValue } from "../../outcomes";

export type PortfolioLearningId = Identifier<string>;
export type PortfolioLearningAssessmentId = Identifier<string>;
export type PortfolioLearningCategory =
  | "investment" | "revenue" | "operations" | "guest-experience" | "capital" | "risk"
  | "portfolio-composition" | "recommendation" | "execution" | "measurement" | "strategy";
export type PortfolioLearningType =
  | "successful-pattern" | "failure-pattern" | "conditional-pattern" | "assumption-bias"
  | "execution-pattern" | "risk-pattern" | "resilience-pattern" | "measurement-pattern"
  | "unexpected-effect-pattern" | "strategy-alignment-pattern";
export type PortfolioLearningMaturity = "candidate" | "emerging" | "supported" | "validated" | "contested" | "invalidated";
export type PortfolioLearningStatus = "active" | "under-review" | "superseded" | "retired";
export type PortfolioLearningReadiness = "ready" | "emerging" | "limited" | "blocked";
export type PortfolioLearningFreshness = "current" | "aging" | "stale" | "historical" | "unknown";
export type PortfolioLearningPersistence = "persistent" | "recurring" | "temporary" | "one-time" | "unknown";
export type PortfolioLearningPriority = "critical" | "high" | "medium" | "low" | "informational";
export type PortfolioLearningStatementCode =
  | "DECISION_TYPE_SUCCESS_REPEATABLE" | "DECISION_TYPE_FAILURE_REPEATABLE"
  | "ASSUMPTIONS_SYSTEMATICALLY_OPTIMISTIC" | "ASSUMPTIONS_SYSTEMATICALLY_CONSERVATIVE"
  | "GUARDRAIL_VIOLATION_RECURRING" | "UNEXPECTED_NEGATIVE_EFFECT_RECURRING"
  | "UNEXPECTED_POSITIVE_EFFECT_RECURRING" | "RECOMMENDATION_TYPE_EFFECTIVE"
  | "RECOMMENDATION_TYPE_INEFFECTIVE" | "RECOMMENDATION_TYPE_HARMFUL"
  | "RECOMMENDATION_TYPE_EFFECTIVE_CONDITIONALLY" | "PARTIAL_EXECUTION_LIMITS_OUTCOMES"
  | "EXECUTION_DELAY_REDUCES_OUTCOME_QUALITY" | "MISSING_BASELINES_LIMIT_LEARNING"
  | "LOW_ATTRIBUTION_LIMITS_LEARNING" | "INCONCLUSIVE_OUTCOMES_LIMIT_LEARNING";

export type PortfolioLearningObservationWindow = Readonly<{ start: Date; end: Date }>;
export type PortfolioLearningCondition = Readonly<{
  dimension: "market" | "property-type" | "operating-model" | "seasonality" | "portfolio-stage"
    | "capital-posture" | "health-band" | "execution-speed" | "recommendation-type" | "decision-type";
  operator: "equals" | "not-equals" | "in" | "greater-than" | "less-than" | "between";
  value: string | number | readonly string[];
}>;
export type PortfolioLearningScope = Readonly<{
  level: "portfolio" | "market" | "property" | "property-type" | "operating-model" | "recommendation-type" | "decision-type";
  subjectIds: readonly string[];
  marketKeys: readonly string[];
  propertyTypes: readonly string[];
  operatingModels: readonly string[];
  recommendationTypes: readonly RecommendationTypeId[];
  decisionTypes: readonly string[];
  observationWindow: PortfolioLearningObservationWindow;
}>;
export type PortfolioLearningPatternSubject =
  | Readonly<{ type: "decision-type"; decisionType: string }>
  | Readonly<{ type: "recommendation-type"; recommendationType: RecommendationTypeId }>
  | Readonly<{ type: "assumption"; metricKey: OutcomeMetricKey }>
  | Readonly<{ type: "execution-behavior"; behaviorCode: string }>
  | Readonly<{ type: "portfolio-condition"; conditionCode: string }>
  | Readonly<{ type: "measurement-practice"; practiceCode: string }>;
export type PortfolioLearningObservedEffect =
  | Readonly<{ kind: "quantitative"; metricKey: OutcomeMetricKey; direction: "increase" | "decrease" | "mixed"; centralEstimate: OutcomeValue | null; range?: Readonly<{ minimum: OutcomeValue; maximum: OutcomeValue }>; methodology: "median" | "weighted-average" | "mean" | "rate" | "distribution" | "not-comparable" }>
  | Readonly<{ kind: "classification"; distribution: Readonly<Record<OutcomeClassification, number>> }>
  | Readonly<{ kind: "qualitative"; effectCodes: readonly string[]; direction: "positive" | "negative" | "mixed" | "neutral" }>;
export type PortfolioLearningPattern = Readonly<{
  direction: "positive" | "negative" | "mixed" | "neutral";
  relationship: "associated-with" | "consistently-precedes" | "conditioned-by" | "increases-likelihood" | "decreases-likelihood" | "systematic-bias" | "measurement-limitation";
  subject: PortfolioLearningPatternSubject;
  outcome: Readonly<{
    metricKeys: readonly OutcomeMetricKey[];
    outcomeClassifications: readonly OutcomeClassification[];
    affectedHealthDimensions: readonly string[];
    recommendationEffectiveness?: RecommendationEffectiveness;
    qualitativeEffectCodes: readonly string[];
  }>;
  effect: PortfolioLearningObservedEffect;
  recurrence: PortfolioLearningRecurrence;
  consistency: PortfolioLearningConsistency;
}>;
export type PortfolioLearningRecurrence = Readonly<{
  eligibleAssessmentCount: number;
  supportingCount: number;
  contradictingCount: number;
  inconclusiveCount: number;
  supportRate: Percentage | null;
  contradictionRate: Percentage | null;
  observedAcrossDistinctSubjects: number;
  observedAcrossDistinctPeriods: number;
}>;
export type PortfolioLearningConsistency = Readonly<{
  classification: "high" | "moderate" | "low" | "contradictory" | "unknown";
  score: Score | null;
  varianceAvailable: boolean;
  limitingFactors: readonly ("SMALL_SAMPLE" | "LOW_SUBJECT_DIVERSITY" | "LOW_PERIOD_DIVERSITY" | "CONTRADICTORY_EVIDENCE" | "CONTEXT_DIFFERENCES" | "INCOMPATIBLE_VARIANCE")[];
}>;
export type PortfolioLearningSampleAssessment = Readonly<{
  eligibleCount: number;
  minimumRequired: number;
  distinctSubjectCount: number;
  minimumDistinctSubjects: number;
  distinctPeriodCount: number;
  sufficient: boolean;
  limitations: readonly ("SAMPLE_TOO_SMALL" | "SUBJECT_DIVERSITY_LOW" | "PERIOD_DIVERSITY_LOW")[];
}>;
export type PortfolioLearningAssessmentReference = Readonly<{
  type: "decision-outcome" | "recommendation-effectiveness";
  assessmentId: string;
  version: number;
  subjectId?: string;
  periodKey?: string;
  confidence: number;
}>;
export type PortfolioLearningEvidenceSummary = Readonly<{
  decisionOutcomeAssessments: readonly PortfolioLearningAssessmentReference[];
  recommendationEffectivenessAssessments: readonly PortfolioLearningAssessmentReference[];
  totalEligible: number;
  totalSupporting: number;
  totalContradicting: number;
  totalInconclusive: number;
  evidenceCoverage: Percentage;
  averageOutcomeConfidence: ConfidenceAssessment;
  averageAttributionConfidence: ConfidenceAssessment;
  dataFreshness: PortfolioLearningFreshness;
}>;
export type PortfolioLearningContradictionSummary = Readonly<{
  status: "none" | "minor" | "material" | "dominant" | "unknown";
  count: number;
  proportion: Percentage | null;
  references: readonly PortfolioLearningAssessmentReference[];
  contextualExplanations: readonly Readonly<{ dimension: string; supportingValue: string; contradictingValue: string }>[];
}>;
export type PortfolioLearningApplicability = Readonly<{
  status: "broad" | "conditional" | "narrow" | "unknown";
  supportedConditions: readonly PortfolioLearningCondition[];
  unsupportedConditions: readonly PortfolioLearningCondition[];
  contradictedConditions: readonly PortfolioLearningCondition[];
  boundaryConfidence: ConfidenceAssessment;
}>;
export type PortfolioLearningMateriality = Readonly<{
  classification: "transformational" | "material" | "moderate" | "minor" | "unknown";
  financialImpact?: Readonly<{ currency: string; amount: Money; methodology: string }>;
  healthImpact?: readonly Readonly<{ dimension: string; direction: "positive" | "negative"; magnitude: number | null }>[];
  strategicImpact: "high" | "moderate" | "low" | "unknown";
  evidence: readonly PortfolioLearningAssessmentReference[];
}>;
export type PortfolioLearningConfidence = Readonly<{
  assessment: ConfidenceAssessment;
  sampleQuality: ConfidenceAssessment;
  consistencyQuality: ConfidenceAssessment;
  evidenceQuality: ConfidenceAssessment;
  attributionQuality: ConfidenceAssessment;
  contextQuality: ConfidenceAssessment;
  recencyQuality: ConfidenceAssessment;
  penalties: readonly Readonly<{ code: string; points: number }>[];
}>;
export type PortfolioLearningLimitation = Readonly<{
  code: "LEARNING_SAMPLE_TOO_SMALL" | "LEARNING_SUBJECT_DIVERSITY_LOW" | "LEARNING_PERIOD_DIVERSITY_LOW"
    | "LEARNING_ATTRIBUTION_WEAK" | "LEARNING_EVIDENCE_CONTRADICTORY" | "LEARNING_CONTEXT_INCOMPLETE"
    | "LEARNING_METRICS_INCOMPATIBLE" | "LEARNING_EVIDENCE_STALE" | "LEARNING_SEGMENT_OVERFIT_RISK"
    | "LEARNING_POLICY_INCOMPATIBLE" | "LEARNING_SOURCE_UNAVAILABLE";
  impact: "minor" | "material" | "blocking";
  source: "sample" | "evidence" | "attribution" | "context" | "recency" | "comparability" | "measurement";
  affectedAssessmentIds: readonly string[];
}>;
export type PortfolioLearningLineage = Readonly<{
  portfolioVersion: number;
  decisionOutcomeAssessmentIds: readonly DecisionOutcomeAssessmentId[];
  recommendationEffectivenessAssessmentIds: readonly RecommendationEffectivenessAssessmentId[];
  predecessorLearningId?: PortfolioLearningId;
  supersedingLearningId?: PortfolioLearningId;
  snapshotFingerprint: string;
}>;
export type PortfolioLearningKey = Readonly<{
  portfolioId: string;
  category: PortfolioLearningCategory;
  type: PortfolioLearningType;
  statementCode: PortfolioLearningStatementCode;
  scopeFingerprint: string;
}>;
export type PortfolioLearning = Readonly<{
  id: PortfolioLearningId;
  ownerId: OutcomeOwnerId;
  portfolioId: string;
  key: PortfolioLearningKey;
  category: PortfolioLearningCategory;
  type: PortfolioLearningType;
  statementCode: PortfolioLearningStatementCode;
  status: PortfolioLearningStatus;
  maturity: PortfolioLearningMaturity;
  priority: PortfolioLearningPriority;
  readiness: PortfolioLearningReadiness;
  scope: PortfolioLearningScope;
  pattern: PortfolioLearningPattern;
  evidence: PortfolioLearningEvidenceSummary;
  contradictions: PortfolioLearningContradictionSummary;
  applicability: PortfolioLearningApplicability;
  materiality: PortfolioLearningMateriality;
  confidence: PortfolioLearningConfidence;
  freshness: PortfolioLearningFreshness;
  persistence: PortfolioLearningPersistence;
  limitations: readonly PortfolioLearningLimitation[];
  lineage: PortfolioLearningLineage;
  policyVersion: string;
  evaluatedAt: Date;
  effectiveFrom: Date;
  effectiveThrough?: Date;
  version: number;
}>;
export type PortfolioLearningPatternCandidate = Readonly<{
  key: PortfolioLearningKey;
  category: PortfolioLearningCategory;
  type: PortfolioLearningType;
  statementCode: PortfolioLearningStatementCode;
  scope: PortfolioLearningScope;
  supportingAssessments: readonly PortfolioLearningAssessmentReference[];
  contradictingAssessments: readonly PortfolioLearningAssessmentReference[];
  inconclusiveAssessments: readonly PortfolioLearningAssessmentReference[];
  observedEffect: PortfolioLearningObservedEffect;
  recurrence: PortfolioLearningRecurrence;
  consistency: PortfolioLearningConsistency;
  sample: PortfolioLearningSampleAssessment;
  confidence: ConfidenceAssessment;
  applicabilityConditions: readonly PortfolioLearningCondition[];
  materialityHint: "critical" | "high" | "moderate" | "low" | "unknown";
  metricVariances: readonly Readonly<{ metricKey: OutcomeMetricKey; variance: OutcomeVariance }>[];
}>;
export type PortfolioExceptionalLearning = Readonly<{
  severity: "high" | "critical";
  eventReference: PortfolioLearningAssessmentReference;
  recurrenceRequired: false;
  confidence: ConfidenceAssessment;
  limitationCode: "SINGLE_EVENT";
}>;
export type PortfolioLearningChange = Readonly<{
  learningKey: PortfolioLearningKey;
  comparable: boolean;
  direction: "strengthened" | "weakened" | "unchanged" | "narrowed" | "broadened" | "contradicted" | "invalidated" | "not-comparable";
  maturityChange?: Readonly<{ from: PortfolioLearningMaturity; to: PortfolioLearningMaturity }>;
  confidenceChange?: number;
  newSupportingEvidence: readonly PortfolioLearningAssessmentReference[];
  newContradictingEvidence: readonly PortfolioLearningAssessmentReference[];
  applicabilityChanges: readonly Readonly<{ type: "added" | "removed"; condition: PortfolioLearningCondition }>[];
}>;
export type PortfolioLearningAssessment = Readonly<{
  id: PortfolioLearningAssessmentId;
  ownerId: OutcomeOwnerId;
  portfolioId: string;
  portfolioVersion: number;
  policyVersion: string;
  evaluatedAt: Date;
  observationWindow: PortfolioLearningObservationWindow;
  learnings: readonly PortfolioLearning[];
  candidates: readonly PortfolioLearningPatternCandidate[];
  exceptionalLearnings: readonly PortfolioExceptionalLearning[];
  changes: readonly PortfolioLearningChange[];
  summary: Readonly<{ activeLearningCount: number; validatedCount: number; supportedCount: number; emergingCount: number; contestedCount: number; criticalLearningCount: number; strongestLearningId?: PortfolioLearningId; highestPriorityLearningId?: PortfolioLearningId; measurementQualityLearningCount: number }>;
  confidence: ConfidenceAssessment;
  limitations: readonly PortfolioLearningLimitation[];
  snapshotFingerprint: string;
  version: number;
}>;

export type PortfolioLearningAssessmentContext = Readonly<{
  assessmentId: DecisionOutcomeAssessmentId;
  decisionType: string;
  subjectId: string;
  propertyId?: string;
  market?: string;
  propertyType?: string;
  operatingModel?: string;
  seasonality?: string;
  capitalPosture?: string;
  healthBand?: string;
  executionSpeed?: "fast" | "normal" | "delayed" | "unknown";
  partialExecution?: boolean;
  concurrentInterventions?: boolean;
  periodKey: string;
}>;
export type PortfolioLearningPortfolioSource = Readonly<{
  portfolioId: string;
  ownerId: OutcomeOwnerId;
  portfolioVersion: number;
  lifecycleStage: "formation" | "operating" | "growth" | "stabilization" | "exit" | "unknown";
  propertyReferences: readonly Readonly<{ propertyId: string; market?: string; propertyType?: string; operatingModel?: string }>[];
  strategyReferences: readonly Readonly<{ goalId: string; category: string } >[];
  assessmentContexts: readonly PortfolioLearningAssessmentContext[];
  reportingCurrency?: string;
  capturedAt: Date;
}>;
export type PortfolioLearningPolicy = Readonly<{
  version: string;
  sample: Readonly<{ emerging: number; supported: number; validated: number; minimumDistinctSubjects: number; validatedDistinctSubjects: number; validatedDistinctPeriods: number }>;
  consistency: Readonly<{ highSupportRate: number; moderateSupportRate: number }>;
  contradiction: Readonly<{ minorRate: number; materialRate: number; dominantRate: number; invalidationRate: number }>;
  confidence: Readonly<{ minimumEligible: number; supported: number; validated: number }>;
  recency: Readonly<{ currentDays: number; agingDays: number; staleDays: number }>;
  segmentation: Readonly<{ approvedDimensions: readonly PortfolioLearningCondition["dimension"][]; minimumSegmentSample: number; maximumSegments: number }>;
  limits: Readonly<{ decisionAssessments: number; effectivenessAssessments: number; candidates: number; learnings: number; supportingReferences: number; contradictingReferences: number; conditions: number; changes: number }>;
  allowLimitedDecisionAssessments: boolean;
  allowLimitedEffectivenessAssessments: boolean;
  compatibleDecisionPolicyVersions: readonly string[];
  compatibleEffectivenessPolicyVersions: readonly string[];
}>;
export type EvaluatePortfolioLearningInput = Readonly<{
  assessmentId: PortfolioLearningAssessmentId;
  portfolio: PortfolioLearningPortfolioSource;
  decisionOutcomes: readonly DecisionOutcomeAssessment[];
  recommendationEffectiveness: readonly RecommendationEffectivenessAssessment[];
  policy: PortfolioLearningPolicy;
  evaluatedAt: Date;
  observationWindow: PortfolioLearningObservationWindow;
  previousAssessment?: PortfolioLearningAssessment;
}>;
