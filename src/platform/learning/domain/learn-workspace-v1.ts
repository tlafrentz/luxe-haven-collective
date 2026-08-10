import type { ExecuteDataQuality, ExecuteOutcomeClassification } from "./execute-outcome-measurement";

export type LearningSignalSourceType = "outcome" | "action" | "blocker" | "measurement" | "decision" | "recurring-occurrence" | "review-return";
export type LearningSignalEligibility = "eligible" | "ineligible" | "invalidated" | "superseded";
export type LessonLifecycleStatus = "draft" | "awaiting-evidence" | "ready-for-review" | "awaiting-review" | "approved" | "rejected" | "needs-reevaluation" | "superseded" | "retired" | "archived";
export type LessonEvidenceStrength = "strong" | "moderate" | "limited" | "conflicting" | "insufficient";
export type LessonConfidence = "high" | "medium" | "low" | "unknown";
export type LessonApplicabilityScope = "single-property" | "selected-properties" | "property-cohort" | "owner-portfolio" | "customer-portfolio" | "market" | "property-type" | "action-category" | "decision-category" | "operating-process" | "defined-context";

export type FinalizedOutcomeLearningSource = Readonly<{
  outcomeId: string;
  outcomeVersion: number;
  workspaceId: string;
  propertyIds: readonly string[];
  sourceActionId: string;
  sourcePlanId?: string;
  sourceDecisionId?: string;
  sourceState: "finalized" | "inconclusive" | "not-measurable" | "reopened" | "superseded";
  classification: ExecuteOutcomeClassification;
  confidence: LessonConfidence;
  dataQuality: ExecuteDataQuality;
  measurementType: string;
  metricCategory: string;
  measurementWindow: Readonly<{ start: string; end: string; timezone: string }>;
  baselineToActual?: Readonly<{ baseline: unknown; actual: unknown; absoluteVariance?: number; relativeVariance?: number }>;
  targetVariance?: number;
  requiredGuardrailsPassed?: boolean;
  attributionCaveat: string;
  finalizedAt: string;
}>;

export type LearningSignal = Readonly<{
  id: string;
  workspaceId: string;
  sourceType: "outcome";
  sourceRecordId: string;
  sourceVersion: number;
  sourceStatus: FinalizedOutcomeLearningSource["sourceState"];
  propertyIds: readonly string[];
  category: string;
  normalizedResult: ExecuteOutcomeClassification;
  confidence: LessonConfidence;
  dataQuality: ExecuteDataQuality;
  observationPeriod: FinalizedOutcomeLearningSource["measurementWindow"];
  effectiveAt: string;
  context: Readonly<Record<string, string | number | boolean | readonly string[]>>;
  eligibility: LearningSignalEligibility;
  eligibilityReason: string;
  createdAt: string;
  idempotencyKey: string;
}>;

export type LearningLessonApplicabilityV1 = Readonly<{
  scope: LessonApplicabilityScope;
  propertyIds: readonly string[];
  conditions: readonly Readonly<{ key: string; operator: "equals" | "in" | "between" | "at-least" | "at-most"; value: unknown }>[];
  exclusions: readonly string[];
}>;

export type LessonConfidenceAssessment = Readonly<{
  confidence: LessonConfidence;
  evidenceStrength: LessonEvidenceStrength;
  score: number;
  reasons: readonly string[];
  policyVersion: "lr001-confidence.v1";
}>;

export type ApprovedLearning = Readonly<{
  lessonId: string;
  lessonVersion: number;
  status: "approved";
  statement: string;
  lessonType: string;
  confidence: LessonConfidence;
  evidenceStrength: LessonEvidenceStrength;
  applicability: LearningLessonApplicabilityV1;
  limitations: readonly string[];
  attributionCaveat: string;
  supportingSourceReferences: readonly Readonly<{ type: LearningSignalSourceType; id: string; version: number }>[];
  contradictingSourceCount: number;
  approvedBy: string;
  approvedAt: string;
  lastReviewedAt: string;
}>;

const transitions: Readonly<Record<LessonLifecycleStatus, readonly LessonLifecycleStatus[]>> = Object.freeze({
  draft: ["awaiting-evidence", "ready-for-review", "rejected", "archived"],
  "awaiting-evidence": ["draft", "ready-for-review", "rejected", "archived"],
  "ready-for-review": ["awaiting-review", "draft", "rejected"],
  "awaiting-review": ["approved", "draft", "awaiting-evidence", "rejected"],
  approved: ["needs-reevaluation", "superseded", "retired"],
  rejected: ["draft", "archived"],
  "needs-reevaluation": ["awaiting-review", "approved", "superseded", "retired"],
  superseded: ["archived"],
  retired: ["approved", "archived"],
  archived: [],
});

export class LearnWorkspaceError extends Error {
  public constructor(public readonly code: string, message: string) { super(message); this.name = "LearnWorkspaceError"; Object.freeze(this); }
}

export function ingestFinalizedOutcome(source: FinalizedOutcomeLearningSource, createdAt: string): LearningSignal {
  if (!source.outcomeId || source.outcomeVersion < 1 || !source.workspaceId || !source.sourceActionId) throw new LearnWorkspaceError("LEARNING_SOURCE_NOT_FOUND", "Finalized outcome lineage is incomplete.");
  if (source.sourceState === "reopened" || source.sourceState === "superseded") throw new LearnWorkspaceError("LEARNING_SOURCE_VERSION_CHANGED", "This outcome version changed and must invalidate prior learning before reingestion.");
  if (!source.attributionCaveat.trim()) throw new LearnWorkspaceError("LEARNING_SOURCE_NOT_ELIGIBLE", "Learning intake requires an attribution caveat.");
  const allowed = ["finalized", "inconclusive", "not-measurable"].includes(source.sourceState);
  if (!allowed) throw new LearnWorkspaceError("LEARNING_SOURCE_NOT_ELIGIBLE", "Outcome is not terminal and stable.");
  const idempotencyKey = `learning-signal:outcome:${source.outcomeId}:v${source.outcomeVersion}`;
  return Object.freeze({ id: idempotencyKey, workspaceId: source.workspaceId, sourceType: "outcome", sourceRecordId: source.outcomeId, sourceVersion: source.outcomeVersion, sourceStatus: source.sourceState, propertyIds: Object.freeze([...source.propertyIds]), category: source.metricCategory, normalizedResult: source.classification, confidence: source.confidence, dataQuality: source.dataQuality, observationPeriod: Object.freeze({ ...source.measurementWindow }), effectiveAt: source.finalizedAt, context: Object.freeze({ sourceActionId: source.sourceActionId, ...(source.sourcePlanId ? { sourcePlanId: source.sourcePlanId } : {}), ...(source.sourceDecisionId ? { sourceDecisionId: source.sourceDecisionId } : {}), measurementType: source.measurementType, attributionCaveat: source.attributionCaveat }), eligibility: "eligible", eligibilityReason: source.classification === "inconclusive" || source.classification === "not-measurable" ? "Eligible for measurement or execution learning; not practice-success learning." : "Stable finalized outcome with intact Execute lineage.", createdAt, idempotencyKey });
}

export function transitionLesson(from: LessonLifecycleStatus, to: LessonLifecycleStatus, input: Readonly<{ reason?: string; reviewerAuthorized?: boolean }> = {}): LessonLifecycleStatus {
  if (!transitions[from].includes(to)) throw new LearnWorkspaceError("LESSON_TRANSITION_INVALID", `Invalid lesson transition: ${from} to ${to}.`);
  if (["approved", "rejected"].includes(to) && !input.reviewerAuthorized) throw new LearnWorkspaceError("LESSON_REVIEW_UNAUTHORIZED", "An authorized reviewer is required.");
  if (to === "rejected" && !input.reason?.trim()) throw new LearnWorkspaceError("LESSON_REJECTION_REASON_REQUIRED", "Lesson rejection requires a reason.");
  if (from === "retired" && to === "approved" && !input.reason?.trim()) throw new LearnWorkspaceError("LESSON_OVERRIDE_REASON_REQUIRED", "Reinstating a retired lesson requires a reason.");
  return to;
}

export function assessLessonConfidence(input: Readonly<{ supportingCount: number; contradictingCount: number; propertyCount: number; averageSourceConfidence: number; averageDataQuality: number; prospectiveRatio: number; reopenedSourceCount: number; applicabilityScope: LessonApplicabilityScope }>): LessonConfidenceAssessment {
  if ([input.supportingCount, input.contradictingCount, input.propertyCount, input.reopenedSourceCount].some((value) => value < 0)) throw new LearnWorkspaceError("LESSON_CONFIDENCE_INVALID", "Confidence factors cannot be negative.");
  const evidence = Math.min(35, input.supportingCount * 8);
  const breadth = Math.min(15, input.propertyCount * 5);
  const source = Math.max(0, Math.min(1, input.averageSourceConfidence)) * 20;
  const quality = Math.max(0, Math.min(1, input.averageDataQuality)) * 20;
  const prospective = Math.max(0, Math.min(1, input.prospectiveRatio)) * 10;
  const penalty = Math.min(45, input.contradictingCount * 15 + input.reopenedSourceCount * 10);
  let score = Math.round(Math.max(0, Math.min(100, evidence + breadth + source + quality + prospective - penalty)));
  const broad = ["owner-portfolio", "customer-portfolio", "market", "property-type"].includes(input.applicabilityScope);
  if (broad && input.propertyCount < 3) score = Math.min(score, 49);
  const evidenceStrength: LessonEvidenceStrength = input.supportingCount === 0 ? "insufficient" : input.contradictingCount > input.supportingCount / 2 ? "conflicting" : score >= 80 ? "strong" : score >= 55 ? "moderate" : "limited";
  const confidence: LessonConfidence = evidenceStrength === "insufficient" ? "unknown" : score >= 80 ? "high" : score >= 55 ? "medium" : "low";
  const reasons = [
    `${input.supportingCount} supporting and ${input.contradictingCount} contradicting source(s).`,
    `${input.propertyCount} propert${input.propertyCount === 1 ? "y" : "ies"} represented.`,
    ...(broad && input.propertyCount < 3 ? ["Broad applicability is capped because fewer than three properties are represented."] : []),
    ...(input.reopenedSourceCount ? ["Reopened or amended sources reduce confidence."] : []),
  ];
  return Object.freeze({ confidence, evidenceStrength, score, reasons: Object.freeze(reasons), policyVersion: "lr001-confidence.v1" });
}

export function validateLessonApplicability(applicability: LearningLessonApplicabilityV1, supportingPropertyIds: readonly string[], reason?: string): LearningLessonApplicabilityV1 {
  if (!applicability.conditions.length && !applicability.propertyIds.length && applicability.scope !== "customer-portfolio" && applicability.scope !== "owner-portfolio") throw new LearnWorkspaceError("LESSON_APPLICABILITY_REQUIRED", "A lesson requires explicit applicability.");
  const unsupported = applicability.propertyIds.some((propertyId) => !supportingPropertyIds.includes(propertyId));
  if (unsupported && !reason?.trim()) throw new LearnWorkspaceError("LESSON_APPLICABILITY_UNSUPPORTED", "Broadening applicability beyond supporting evidence requires a reason and review.");
  return Object.freeze({ ...applicability, propertyIds: Object.freeze([...applicability.propertyIds]), conditions: Object.freeze([...applicability.conditions]), exclusions: Object.freeze([...applicability.exclusions]) });
}

export function approvedLearningBoundary(records: readonly ApprovedLearning[]): readonly ApprovedLearning[] {
  return Object.freeze(records.filter((record) => record.status === "approved").map((record) => Object.freeze({ ...record, limitations: Object.freeze([...record.limitations]), supportingSourceReferences: Object.freeze([...record.supportingSourceReferences]) })));
}
