export type LearningRecommendationStatus = "draft" | "awaiting-context" | "ready-for-review" | "awaiting-review" | "revision-requested" | "accepted" | "rejected" | "deferred" | "dismissed" | "handed-off" | "in-progress" | "implemented" | "measurement-pending" | "evaluated" | "needs-reevaluation" | "superseded" | "expired" | "archived";
export type RecommendationMatch = "strong-match" | "qualified-match" | "partial-match" | "insufficient-context" | "excluded" | "not-applicable";
export type RecommendationStrength = "strong" | "moderate" | "limited" | "investigatory" | "insufficient";
export type RecommendationConfidence = "high" | "medium" | "low" | "unknown";
export type RecommendationEvidenceStrength = "strong" | "moderate" | "limited" | "conflicting" | "insufficient";

/** Structural LR-001 boundary. Recommendations never read Learning persistence directly. */
export type ApprovedLearningSource = Readonly<{
  lessonId: string;
  lessonVersion: number;
  status: "approved" | "needs-reevaluation" | "superseded" | "retired";
  statement: string;
  lessonType: string;
  confidence: RecommendationConfidence;
  evidenceStrength: RecommendationEvidenceStrength;
  applicability: Readonly<{
    scope: string;
    propertyIds: readonly string[];
    conditions: readonly Readonly<{ key: string; operator: "equals" | "in" | "between" | "at-least" | "at-most"; value: unknown }>[];
    exclusions: readonly string[];
  }>;
  limitations: readonly string[];
  supportingSourceReferences: readonly Readonly<{ type: string; id: string; version: number }>[];
  contradictingSourceCount: number;
  approvedBy: string;
  approvedAt: string;
  lastReviewedAt: string;
}>;

export type RecommendationTargetContext = Readonly<{
  targetType: "property" | "selected-properties" | "portfolio" | "decision" | "action-plan" | "recurring-template" | "measurement-plan" | "operating-policy";
  targetId: string;
  contextVersion: number;
  propertyIds: readonly string[];
  attributes: Readonly<Record<string, unknown>>;
  dataQuality: "complete" | "sufficient" | "limited" | "conflicting" | "stale" | "missing" | "invalid";
}>;

export type LearningRecommendationApplicability = Readonly<{
  match: RecommendationMatch;
  matches: readonly string[];
  partialMatches: readonly string[];
  mismatches: readonly string[];
  unknowns: readonly string[];
  exclusionsEvaluated: readonly string[];
  exclusionsTriggered: readonly string[];
  contextualDifferences: readonly string[];
  requiredValidation: readonly string[];
  explanation: readonly string[];
  lessonVersion: number;
  targetContextVersion: number;
  policyVersion: "lr002-applicability.v1";
}>;

export type LearningRecommendationAssessment = Readonly<{
  confidence: RecommendationConfidence;
  strength: RecommendationStrength;
  score: number;
  explanation: readonly string[];
  policyVersion: "lr002-strength.v1";
}>;

export type RecommendationHandoff = Readonly<{
  recommendationId: string;
  recommendationVersion: number;
  handoffType: "decision" | "draft-action-plan" | "template-change-proposal" | "policy-review" | "measurement-change-proposal";
  status: "requested";
  correlationId: string;
  idempotencyKey: string;
  sourceLessonVersions: readonly Readonly<{ id: string; version: number }>[];
  target: Readonly<{ type: string; id: string; propertyIds: readonly string[] }>;
  expectedResult: string;
  measurementExpectation: string;
}>;

const transitions: Readonly<Record<LearningRecommendationStatus, readonly LearningRecommendationStatus[]>> = Object.freeze({
  draft: ["awaiting-context", "ready-for-review", "dismissed", "archived"],
  "awaiting-context": ["draft", "ready-for-review", "dismissed", "expired"],
  "ready-for-review": ["awaiting-review", "draft", "dismissed"],
  "awaiting-review": ["accepted", "rejected", "deferred", "revision-requested"],
  "revision-requested": ["draft", "ready-for-review", "dismissed"],
  accepted: ["handed-off", "deferred", "needs-reevaluation", "expired"],
  rejected: ["draft", "archived"],
  deferred: ["ready-for-review", "rejected", "dismissed", "expired"],
  dismissed: ["archived"],
  "handed-off": ["in-progress", "needs-reevaluation", "superseded"],
  "in-progress": ["implemented", "needs-reevaluation", "superseded"],
  implemented: ["measurement-pending", "evaluated", "needs-reevaluation"],
  "measurement-pending": ["evaluated", "needs-reevaluation"],
  evaluated: ["archived"],
  "needs-reevaluation": ["ready-for-review", "accepted", "superseded", "dismissed"],
  superseded: ["archived"], expired: ["draft", "archived"], archived: [],
});

export class LearningRecommendationError extends Error {
  public constructor(public readonly code: string, message: string) { super(message); this.name = "LearningRecommendationError"; Object.freeze(this); }
}

export function requireEligibleLearning(source: ApprovedLearningSource, evaluatedAt: string, maximumAgeDays = 365): ApprovedLearningSource {
  if (source.status !== "approved") throw new LearningRecommendationError(source.status === "needs-reevaluation" ? "RECOMMENDATION_REEVALUATION_REQUIRED" : "RECOMMENDATION_SOURCE_NOT_ELIGIBLE", "Only current approved learning may support a recommendation.");
  if (!source.supportingSourceReferences.length || source.evidenceStrength === "insufficient") throw new LearningRecommendationError("RECOMMENDATION_SOURCE_NOT_ELIGIBLE", "Approved learning lacks sufficient source evidence.");
  if ((Date.parse(evaluatedAt) - Date.parse(source.lastReviewedAt)) / 86_400_000 > maximumAgeDays) throw new LearningRecommendationError("RECOMMENDATION_SOURCE_NOT_ELIGIBLE", "Approved learning is stale and requires review.");
  return source;
}

export function transitionLearningRecommendation(from: LearningRecommendationStatus, to: LearningRecommendationStatus, input: Readonly<{ reviewerAuthorized?: boolean; reason?: string; deferralCondition?: string }> = {}): LearningRecommendationStatus {
  if (!transitions[from].includes(to)) throw new LearningRecommendationError("RECOMMENDATION_TRANSITION_INVALID", `Invalid recommendation transition: ${from} to ${to}.`);
  if (["accepted", "rejected", "deferred"].includes(to) && !input.reviewerAuthorized) throw new LearningRecommendationError("RECOMMENDATION_REVIEW_UNAUTHORIZED", "An authorized reviewer is required.");
  if (to === "rejected" && !input.reason?.trim()) throw new LearningRecommendationError("RECOMMENDATION_REJECTION_REASON_REQUIRED", "Rejection requires a reason.");
  if (to === "dismissed" && !input.reason?.trim()) throw new LearningRecommendationError("RECOMMENDATION_OVERRIDE_REASON_REQUIRED", "Dismissal requires a reason.");
  if (to === "deferred" && !input.deferralCondition?.trim()) throw new LearningRecommendationError("RECOMMENDATION_DEFERRAL_CONDITION_REQUIRED", "Deferral requires a review date or condition.");
  return to;
}

export function assessLearningApplicability(lesson: ApprovedLearningSource, target: RecommendationTargetContext): LearningRecommendationApplicability {
  const evaluatedAt = target.attributes.evaluatedAt;
  if (typeof evaluatedAt !== "string" || !Number.isFinite(Date.parse(evaluatedAt))) throw new LearningRecommendationError("RECOMMENDATION_TARGET_CONTEXT_INSUFFICIENT", "Target context requires a deterministic evaluation timestamp.");
  requireEligibleLearning(lesson, evaluatedAt);
  const matches: string[] = [], mismatches: string[] = [], unknowns: string[] = [], partial: string[] = [];
  for (const condition of lesson.applicability.conditions) {
    const actual = target.attributes[condition.key];
    if (actual === undefined || actual === null) { unknowns.push(condition.key); continue; }
    if (conditionMatches(condition, actual)) matches.push(condition.key); else mismatches.push(condition.key);
  }
  const exclusionsTriggered = lesson.applicability.exclusions.filter((exclusion) => target.attributes.exclusions instanceof Array && target.attributes.exclusions.includes(exclusion));
  const outsidePropertyScope = lesson.applicability.scope === "single-property" && target.propertyIds.some((id) => !lesson.applicability.propertyIds.includes(id));
  if (outsidePropertyScope) partial.push("Target expands a property-specific lesson beyond its validated property.");
  const match: RecommendationMatch = exclusionsTriggered.length ? "excluded" : mismatches.length ? "not-applicable" : unknowns.length ? "insufficient-context" : partial.length ? "partial-match" : matches.length === lesson.applicability.conditions.length ? "strong-match" : "qualified-match";
  const requiredValidation = match === "partial-match" ? ["Frame the recommendation as an investigation, decision review, or controlled experiment."] : match === "insufficient-context" ? ["Supply the missing target context before review."] : [];
  return Object.freeze({ match, matches: Object.freeze(matches), partialMatches: Object.freeze(partial), mismatches: Object.freeze(mismatches), unknowns: Object.freeze(unknowns), exclusionsEvaluated: Object.freeze([...lesson.applicability.exclusions]), exclusionsTriggered: Object.freeze(exclusionsTriggered), contextualDifferences: Object.freeze(partial), requiredValidation: Object.freeze(requiredValidation), explanation: Object.freeze([`${matches.length} condition(s) matched, ${mismatches.length} mismatched, and ${unknowns.length} remain unknown.`, ...(outsidePropertyScope ? ["The target is broader than the source lesson."] : [])]), lessonVersion: lesson.lessonVersion, targetContextVersion: target.contextVersion, policyVersion: "lr002-applicability.v1" });
}

export function assessLearningRecommendation(input: Readonly<{ lesson: ApprovedLearningSource; applicability: LearningRecommendationApplicability; targetDataQuality: RecommendationTargetContext["dataQuality"]; supportingLessonCount: number; contradictingLessonCount: number; risk: "low" | "medium" | "high" | "critical"; reversible: boolean; measurementReady: boolean }>): LearningRecommendationAssessment {
  const confidenceCeiling = ({ high: 100, medium: 74, low: 49, unknown: 24 } as const)[input.lesson.confidence];
  const evidenceCeiling = ({ strong: 100, moderate: 74, limited: 49, conflicting: 29, insufficient: 0 } as const)[input.lesson.evidenceStrength];
  const matchCeiling = ({ "strong-match": 100, "qualified-match": 79, "partial-match": 49, "insufficient-context": 24, excluded: 0, "not-applicable": 0 } as const)[input.applicability.match];
  const qualityCeiling = ({ complete: 100, sufficient: 80, limited: 49, conflicting: 24, stale: 29, missing: 0, invalid: 0 } as const)[input.targetDataQuality];
  let score = Math.min(confidenceCeiling, evidenceCeiling, matchCeiling, qualityCeiling);
  score += Math.min(10, Math.max(0, input.supportingLessonCount - 1) * 3);
  score -= Math.min(30, input.contradictingLessonCount * 10);
  score -= input.risk === "critical" ? 20 : input.risk === "high" ? 10 : 0;
  score += input.reversible ? 5 : 0;
  score += input.measurementReady ? 5 : -10;
  score = Math.max(0, Math.min(Math.min(confidenceCeiling, evidenceCeiling), Math.round(score)));
  const investigatory = input.applicability.match === "partial-match" || input.lesson.applicability.scope === "single-property" && input.applicability.partialMatches.length > 0;
  const strength: RecommendationStrength = score >= 80 ? "strong" : score >= 60 ? "moderate" : investigatory ? "investigatory" : score >= 30 ? "limited" : "insufficient";
  const confidence: RecommendationConfidence = score >= 80 ? "high" : score >= 55 ? "medium" : score >= 25 ? "low" : "unknown";
  return Object.freeze({ confidence, strength, score, explanation: Object.freeze([`Recommendation confidence is capped by ${input.lesson.confidence} lesson confidence, ${input.lesson.evidenceStrength} evidence, ${input.applicability.match} applicability, and ${input.targetDataQuality} target data.`, ...(investigatory ? ["Scope expansion requires investigatory framing."] : []), ...(!input.measurementReady ? ["Measurement readiness is incomplete."] : [])]), policyVersion: "lr002-strength.v1" });
}

export function createRecommendationHandoff(input: Omit<RecommendationHandoff, "status" | "idempotencyKey"> & Readonly<{ accepted: boolean; authorized: boolean }>): RecommendationHandoff {
  if (!input.accepted || !input.authorized) throw new LearningRecommendationError("RECOMMENDATION_HANDOFF_NOT_ALLOWED", "Only an accepted recommendation with downstream authority may be handed off.");
  if (!input.expectedResult.trim() || !input.measurementExpectation.trim()) throw new LearningRecommendationError("RECOMMENDATION_MEASUREMENT_REQUIRED", "A handoff requires an expected result and measurement expectation.");
  return Object.freeze({ recommendationId: input.recommendationId, recommendationVersion: input.recommendationVersion, handoffType: input.handoffType, status: "requested", correlationId: input.correlationId, idempotencyKey: `recommendation:${input.recommendationId}:v${input.recommendationVersion}:${input.handoffType}`, sourceLessonVersions: Object.freeze([...input.sourceLessonVersions]), target: Object.freeze({ ...input.target, propertyIds: Object.freeze([...input.target.propertyIds]) }), expectedResult: input.expectedResult, measurementExpectation: input.measurementExpectation });
}

function conditionMatches(condition: ApprovedLearningSource["applicability"]["conditions"][number], actual: unknown): boolean {
  if (condition.operator === "equals") return actual === condition.value;
  if (condition.operator === "in") return Array.isArray(condition.value) && condition.value.includes(actual);
  if (condition.operator === "between") return Array.isArray(condition.value) && condition.value.length === 2 && typeof actual === "number" && actual >= Number(condition.value[0]) && actual <= Number(condition.value[1]);
  if (condition.operator === "at-least") return typeof actual === "number" && actual >= Number(condition.value);
  return typeof actual === "number" && actual <= Number(condition.value);
}
