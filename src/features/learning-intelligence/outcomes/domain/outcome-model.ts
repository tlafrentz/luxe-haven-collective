import type { Identifier, Money, Percentage } from "@/platform/kernel";
import type { ConfidenceAssessment, ConfidenceScore, Score } from "@/platform/scoring";

export type OutcomeId = Identifier<string>;
export type OutcomeOwnerId = Identifier<string>;
export type OutcomeExpectationId = Identifier<string>;
export type OutcomeMeasurementPlanId = Identifier<string>;
export type OutcomeMeasurementWindowId = Identifier<string>;
export type OutcomeMeasurementId = Identifier<string>;
export type OutcomeQualitativeObservationId = Identifier<string>;
export type OutcomeEvidenceId = Identifier<string>;
export type OutcomeMetricKey = Identifier<string>;

export type OutcomeStatus =
  | "planned" | "measuring" | "measurement-complete" | "closed"
  | "inconclusive" | "cancelled" | "superseded";
export type OutcomePlanningMode = "prospective" | "retrospective";

export type OutcomeSubject =
  | Readonly<{ type: "portfolio"; portfolioId: string }>
  | Readonly<{ type: "property"; propertyId: string }>
  | Readonly<{ type: "investment-opportunity"; opportunityId: string }>
  | Readonly<{ type: "acquisition"; opportunityId: string; pipelineId: string }>
  | Readonly<{ type: "recommendation"; recommendationId: string }>
  | Readonly<{ type: "action"; actionId: string }>
  | Readonly<{ type: "business"; businessId?: string }>;

export type OutcomeManualOriginReason =
  | "LEGACY_DECISION" | "DECISION_RECORD_UNAVAILABLE" | "EXTERNAL_DECISION";
export type OutcomeOrigin =
  | Readonly<{ type: "decision"; decisionId: string; decisionVersion?: number }>
  | Readonly<{ type: "recommendation-decision"; recommendationId: string; decisionId: string; decisionVersion?: number }>
  | Readonly<{ type: "executed-action"; actionId: string; decisionId?: string }>
  | Readonly<{ type: "investment-decision"; investmentDecisionId: string; analysisId?: string; analysisVersion?: number }>
  | Readonly<{ type: "acquisition-decision"; decisionId: string; pipelineId: string }>
  | Readonly<{ type: "manual-measurement"; reasonCode: OutcomeManualOriginReason }>;

export type OutcomeActorReference = Readonly<{ type: "user" | "system" | "service"; id: string }>;
export type OutcomeExpectedDirection =
  | "increase" | "decrease" | "maintain" | "achieve" | "avoid" | "complete" | "qualitative-improvement";
export type OutcomeExpectationImportance = "primary" | "secondary" | "guardrail";
export type OutcomeExpectationSource =
  | Readonly<{ type: "decision"; decisionId: string }>
  | Readonly<{ type: "recommendation"; recommendationId: string }>
  | Readonly<{ type: "investment-analysis"; analysisId: string; analysisVersion: number }>
  | Readonly<{ type: "action"; actionId: string }>
  | Readonly<{ type: "manual"; recordedBy: OutcomeActorReference; recordedAt: Date; retrospective?: boolean }>;

export type OutcomeMetricKind = "money" | "percentage" | "ratio" | "count" | "duration" | "score" | "boolean" | "qualitative";
export type OutcomeMetricDefinition = Readonly<{
  key: OutcomeMetricKey;
  name: string;
  kind: OutcomeMetricKind;
  unit?: string;
  aggregation: "sum" | "average" | "weighted-average" | "minimum" | "maximum" | "latest" | "state" | "not-applicable";
  directionality: "higher-is-better" | "lower-is-better" | "target-range" | "context-dependent";
}>;
export type OutcomeQualitativeValue =
  | "improved" | "unchanged" | "deteriorated" | "completed" | "not-completed"
  | "unexpected-positive" | "unexpected-negative" | "unexpected-neutral" | "unknown";
export type OutcomeValue =
  | Readonly<{ kind: "money"; value: Money }>
  | Readonly<{ kind: "percentage"; value: Percentage }>
  | Readonly<{ kind: "ratio"; value: number }>
  | Readonly<{ kind: "count"; value: number }>
  | Readonly<{ kind: "duration"; value: number; unit: "minutes" | "hours" | "days" | "months" }>
  | Readonly<{ kind: "score"; value: Score }>
  | Readonly<{ kind: "boolean"; value: boolean }>
  | Readonly<{ kind: "qualitative"; value: OutcomeQualitativeValue }>;

export type OutcomeObservationReference = Readonly<{ observationId: string; observationVersion?: number }>;
export type OutcomeBaselineMethodology =
  | "immediately-preceding-period" | "year-over-year-period" | "trailing-average"
  | "approved-underwriting" | "portfolio-benchmark" | "property-benchmark"
  | "pre-execution-state" | "manual-authoritative" | "not-applicable";
export type OutcomeMeasurementWindow = Readonly<{
  id: OutcomeMeasurementWindowId;
  type: "baseline" | "implementation" | "initial" | "stabilization" | "primary" | "follow-up";
  start: Date;
  end: Date;
  status: "planned" | "open" | "closed" | "cancelled";
  comparisonWindowId?: OutcomeMeasurementWindowId;
}>;
export type OutcomeBaseline = Readonly<{
  value: OutcomeValue;
  observationWindow: OutcomeMeasurementWindow;
  observationReference: OutcomeObservationReference | null;
  methodology: OutcomeBaselineMethodology;
  confidence: ConfidenceAssessment;
}>;
export type OutcomeTarget =
  | Readonly<{ type: "absolute" | "minimum" | "maximum"; value: OutcomeValue }>
  | Readonly<{ type: "relative-change"; value: Percentage }>
  | Readonly<{ type: "range"; minimum: OutcomeValue; maximum: OutcomeValue }>
  | Readonly<{ type: "state"; expectedState: string }>
  | Readonly<{ type: "completion" }>;
export type OutcomeTolerance =
  | Readonly<{ type: "absolute"; value: OutcomeValue }>
  | Readonly<{ type: "percentage"; value: Percentage }>
  | Readonly<{ type: "none" }>;

export type OutcomeExpectation = Readonly<{
  id: OutcomeExpectationId;
  metric: OutcomeMetricDefinition;
  direction: OutcomeExpectedDirection;
  baseline: OutcomeBaseline | null;
  target: OutcomeTarget;
  tolerance?: OutcomeTolerance;
  importance: OutcomeExpectationImportance;
  measurementWindowId: OutcomeMeasurementWindowId;
  source: OutcomeExpectationSource;
  confidence: ConfidenceAssessment;
  establishedAt: Date;
  reconstructed: boolean;
}>;

export type OutcomeEvidenceRole = "baseline" | "expectation" | "measurement" | "attribution" | "limitation" | "supplemental";
export type OutcomeEvidenceReference = Readonly<{
  id: OutcomeEvidenceId;
  type: "observation" | "metric" | "report" | "action" | "decision" | "recommendation" | "analysis" | "document" | "operator-attestation";
  sourceId: string;
  sourceVersion?: number;
  capturedAt?: Date;
  role: OutcomeEvidenceRole;
  confidence: ConfidenceAssessment;
}>;
export type OutcomeEvidenceRequirement = Readonly<{
  metricKey?: OutcomeMetricKey;
  expectationId?: OutcomeExpectationId;
  requiredRoles: readonly OutcomeEvidenceRole[];
  minimumConfidence?: ConfidenceScore;
  required: boolean;
}>;
export type OutcomeMeasurementCompletionPolicy = Readonly<{
  requiredWindowIds: readonly OutcomeMeasurementWindowId[];
  minimumRequiredMeasurements: number;
  requireEveryPrimaryExpectation: boolean;
  allowPartialCompletion: boolean;
  lateEvidencePolicy: "reject" | "accept-with-warning" | "accept-as-supplemental";
}>;
export type OutcomeAttributionPlan = Readonly<{ required: boolean; approvedBases: readonly OutcomeAttributionBasis["type"][] }>;
export type OutcomeMeasurementPlan = Readonly<{
  id: OutcomeMeasurementPlanId;
  version: number;
  windows: readonly OutcomeMeasurementWindow[];
  requiredExpectations: readonly OutcomeExpectationId[];
  evidenceRequirements: readonly OutcomeEvidenceRequirement[];
  completionPolicy: OutcomeMeasurementCompletionPolicy;
  attributionPlan: OutcomeAttributionPlan;
  approvedAt: Date;
  approvedBy: OutcomeActorReference;
}>;

export type OutcomeMeasurementSource =
  | Readonly<{ type: "platform-observation"; observationId: string; providerType?: string }>
  | Readonly<{ type: "property-performance"; propertyId: string; projectionVersion?: number }>
  | Readonly<{ type: "portfolio-assessment"; portfolioId: string; assessmentId: string }>
  | Readonly<{ type: "investment-analysis"; analysisId: string; analysisVersion: number }>
  | Readonly<{ type: "action-outcome"; actionId: string }>
  | Readonly<{ type: "manual-evidence"; recordedBy: OutcomeActorReference }>;
export type OutcomeDataQualityIssue = Readonly<{ code: string; severity: "warning" | "error" }>;
export type OutcomeMeasurementDataQuality = Readonly<{
  completeness: Percentage;
  freshness: "current" | "stale" | "unknown";
  provenance: "verified" | "trusted" | "reported" | "unknown";
  compatibility: "compatible" | "degraded" | "incompatible" | "unknown";
  issues: readonly OutcomeDataQualityIssue[];
}>;
export type OutcomeMeasurement = Readonly<{
  id: OutcomeMeasurementId;
  expectationId?: OutcomeExpectationId;
  metric: OutcomeMetricDefinition;
  value: OutcomeValue;
  measurementWindowId: OutcomeMeasurementWindowId;
  observedAt: Date;
  recordedAt: Date;
  source: OutcomeMeasurementSource;
  observationReference?: OutcomeObservationReference;
  methodology: "direct-observation" | "period-aggregation" | "weighted-aggregation" | "before-after-comparison" | "derived-from-canonical-metrics" | "verified-manual-entry" | "qualitative-assessment";
  confidence: ConfidenceAssessment;
  dataQuality: OutcomeMeasurementDataQuality;
  status: "authoritative" | "supplemental" | "disputed" | "superseded";
  supersedesMeasurementId?: OutcomeMeasurementId;
  late: boolean;
}>;
export type OutcomeQualitativeObservation = Readonly<{
  id: OutcomeQualitativeObservationId;
  expectationId?: OutcomeExpectationId;
  category: "operator-observation" | "guest-feedback" | "execution-quality" | "risk-condition" | "process-change" | "unexpected-effect";
  value: OutcomeQualitativeValue;
  observedAt: Date;
  recordedAt: Date;
  actor?: OutcomeActorReference;
  evidence: readonly OutcomeEvidenceReference[];
  confidence: ConfidenceAssessment;
}>;

export type OutcomeAttributionBasis = Readonly<{
  type: "temporal-sequence" | "controlled-comparison" | "before-after-comparison" | "operator-attestation" | "mechanism-supported";
  evidence: readonly OutcomeEvidenceReference[];
}>;
export type OutcomeCompetingFactor = Readonly<{
  code: string;
  type: "market" | "seasonality" | "pricing" | "operations" | "property-change" | "competition" | "external-event" | "measurement-change" | "unknown";
  direction: "positive" | "negative" | "mixed" | "unknown";
  evidence: readonly OutcomeEvidenceReference[];
  confidence: ConfidenceAssessment;
}>;
export type OutcomeAttribution = Readonly<{
  status: "not-assessed" | "established" | "supported" | "plausible" | "weak" | "unknown" | "contested";
  basis: readonly OutcomeAttributionBasis[];
  competingFactors: readonly OutcomeCompetingFactor[];
  confidence: ConfidenceAssessment;
  assessedAt?: Date;
  assessedBy?: OutcomeActorReference;
}>;
export type OutcomeConfidence = Readonly<{
  assessment: ConfidenceAssessment;
  expectationQuality: ConfidenceAssessment;
  measurementQuality: ConfidenceAssessment;
  attributionQuality: ConfidenceAssessment;
  evidenceCoverage: Percentage;
  penalties: readonly Readonly<{ code: string; reason: string }>[];
}>;

export type OutcomeExecutionReference =
  | Readonly<{ type: "action"; actionId: string; actionVersion?: number; completedAt?: Date; completion: "complete" | "partial" | "not-started" }>
  | Readonly<{ type: "acquisition-stage"; pipelineId: string; stage: string; completedAt?: Date; completion: "complete" | "partial" }>
  | Readonly<{ type: "manual-execution"; executionId: string; completedAt?: Date; completion: "complete" | "partial" }>;
export type OutcomeLineage = Readonly<{
  decisionReferences: readonly Readonly<{ decisionId: string; decisionVersion?: number }>[];
  recommendationReferences: readonly Readonly<{ recommendationId: string; recommendationVersion?: number }>[];
  executionReferences: readonly OutcomeExecutionReference[];
  observationReferences: readonly OutcomeObservationReference[];
  analysisReferences: readonly Readonly<{ analysisId: string; analysisVersion: number }>[];
  predecessorOutcomeId?: OutcomeId;
  supersedingOutcomeId?: OutcomeId;
  correctionReason?: string;
}>;

export type OutcomeInconclusiveReason =
  | "INSUFFICIENT_MEASUREMENTS" | "MISSING_BASELINE" | "INCOMPATIBLE_WINDOWS"
  | "INSUFFICIENT_ATTRIBUTION" | "CONFLICTING_EVIDENCE" | "SOURCE_UNAVAILABLE"
  | "EXECUTION_NOT_VERIFIABLE" | "MEASUREMENT_PLAN_INVALIDATED";
export type OutcomeDataGap = Readonly<{ code: string; description: string }>;

export type OutcomeEvent = Readonly<{
  eventId: string;
  aggregateId: OutcomeId;
  aggregateVersion: number;
  ownerId: OutcomeOwnerId;
  occurredAt: Date;
  type:
    | "OutcomePlanned" | "OutcomeMeasurementStarted" | "OutcomeMeasurementWindowOpened"
    | "OutcomeMeasurementRecorded" | "OutcomeQualitativeObservationRecorded"
    | "OutcomeEvidenceAttached" | "OutcomeAttributionUpdated"
    | "OutcomeMeasurementWindowClosed" | "OutcomeMeasurementCompleted"
    | "OutcomeMarkedInconclusive" | "OutcomeClosed" | "OutcomeCancelled" | "OutcomeSuperseded";
  references: Readonly<Record<string, string | number | boolean>>;
  idempotencyKey: string;
}>;

export type OutcomeState = Readonly<{
  id: OutcomeId;
  ownerId: OutcomeOwnerId;
  subject: OutcomeSubject;
  origin: OutcomeOrigin;
  planningMode: OutcomePlanningMode;
  status: OutcomeStatus;
  expectations: readonly OutcomeExpectation[];
  measurementPlan: OutcomeMeasurementPlan;
  measurements: readonly OutcomeMeasurement[];
  qualitativeObservations: readonly OutcomeQualitativeObservation[];
  evidence: readonly OutcomeEvidenceReference[];
  attribution: OutcomeAttribution;
  confidence: OutcomeConfidence;
  lineage: OutcomeLineage;
  inconclusive?: Readonly<{ reason: OutcomeInconclusiveReason; dataGaps: readonly OutcomeDataGap[]; markedAt: Date }>;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  events: readonly OutcomeEvent[];
  acceptedIdempotencyKeys: readonly string[];
}>;

export const OUTCOME_LIMITS = Object.freeze({
  expectations: 12, windows: 8, measurements: 100, qualitativeObservations: 30,
  evidence: 100, competingFactors: 20, decisionReferences: 10, executionReferences: 20,
});
