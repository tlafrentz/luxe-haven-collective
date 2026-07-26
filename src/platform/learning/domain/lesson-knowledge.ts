import type { LearningConfidence, LearningReference } from "./learning-lineage";

export type AssumptionCategory =
  | "financial" | "revenue" | "investment" | "capital"
  | "operations" | "guest-experience" | "portfolio";
export type AssumptionValidationStatus =
  | "confirmed" | "partially-confirmed" | "invalidated" | "unable-to-evaluate";
export type LessonStatus =
  | "candidate" | "validated" | "superseded" | "retired" | "contradicted" | "rejected";
export type LessonMaturity = "emerging" | "supported" | "established" | "well-validated";
export type LessonApplicabilityDimension =
  | "workspace" | "portfolio" | "market" | "property" | "property-type"
  | "strategy" | "season" | "guest-segment" | "operating-model";
export type LessonContradictionState = "none" | "possible" | "confirmed";

export type LearningAssumption = Readonly<{
  id: string; workspaceId: string; learningSubjectId: string;
  statement: string; category: AssumptionCategory;
  sourceReviewId: string; createdByProfileId: string; createdAt: string;
}>;
export type ValidatedAssumptionResult = Readonly<{
  id: string; workspaceId: string; assumptionId: string; outcomeReviewId: string;
  status: AssumptionValidationStatus; rationale: string;
  confidence: LearningConfidence; evidence: readonly LearningReference[];
  reviewedByProfileId: string; policyVersion: string; createdAt: string;
}>;
export type LessonApplicabilityRule = Readonly<{
  dimension: LessonApplicabilityDimension; referenceId?: string; value?: string;
}>;
export type CandidateLessonRecord = Readonly<{
  id: string; seriesId: string; revision: number; workspaceId: string;
  learningSubjectId: string; category: AssumptionCategory; statement: string;
  applicability: readonly LessonApplicabilityRule[];
  confidence: LearningConfidence; evidence: readonly LearningReference[];
  sourceReviewIds: readonly string[]; sourceAssumptionResultIds: readonly string[];
  status: "candidate" | "rejected" | "merged";
  policyVersion: string; createdByProfileId: string; createdAt: string;
}>;
export type OrganizationalLesson = Readonly<{
  id: string; seriesId: string; revision: number; workspaceId: string;
  learningSubjectId: string; category: AssumptionCategory; statement: string;
  applicability: readonly LessonApplicabilityRule[];
  confidence: LearningConfidence; maturity: LessonMaturity; status: LessonStatus;
  contradictionState: LessonContradictionState;
  evidence: readonly LearningReference[]; sourceReviewIds: readonly string[];
  sourceCandidateIds: readonly string[]; policyVersion: string;
  supersedesLessonId?: string; retiredReason?: string;
  retiredByProfileId?: string; retiredAt?: string;
  createdByProfileId: string; createdAt: string;
}>;
export type LessonRelationship = Readonly<{
  id: string; workspaceId: string; fromLessonId: string; toLessonId: string;
  type: "supports" | "contradicts" | "supersedes" | "merged-into" | "refines";
  contradictionState: LessonContradictionState; rationale: string;
  evidence: readonly LearningReference[]; policyVersion: string;
  createdByProfileId: string; createdAt: string;
}>;
export type KnowledgeDomainEvent = Readonly<{
  id: string; type: "AssumptionValidated" | "CandidateLessonCreated" |
  "LessonValidated" | "LessonSuperseded" | "LessonRetired" | "LessonContradicted";
  workspaceId: string; aggregateId: string; occurredAt: string;
  references: Readonly<Record<string, string>>;
}>;

export class LessonKnowledgeError extends Error {
  constructor(readonly code:
    | "assumption_invalid" | "review_not_completed" | "lesson_evidence_required"
    | "lesson_applicability_required" | "lesson_transition_invalid"
    | "lesson_revision_conflict" | "lesson_contradiction_invalid"
    | "learning_permission_denied" | "learning_workspace_mismatch",
  message: string) { super(message); this.name = "LessonKnowledgeError"; Object.freeze(this); }
}

export function validateAssumption(input: {
  assumption: LearningAssumption; outcomeReview: Readonly<{
    id: string; workspaceId: string; status: string; confidence: LearningConfidence;
    evidence: readonly LearningReference[];
  }>; status: AssumptionValidationStatus; rationale: string;
  reviewerProfileId: string; policyVersion: string; createdAt: string;
}): Readonly<{ result: ValidatedAssumptionResult; event: KnowledgeDomainEvent }> {
  if (!["completed", "unable-to-evaluate"].includes(input.outcomeReview.status))
    throw new LessonKnowledgeError("review_not_completed", "Only a terminal Outcome Review can validate an assumption.");
  if (input.assumption.workspaceId !== input.outcomeReview.workspaceId ||
      input.assumption.sourceReviewId !== input.outcomeReview.id)
    throw new LessonKnowledgeError("learning_workspace_mismatch", "Assumption and Outcome Review lineage do not match.");
  if (!input.assumption.statement.trim() || !input.rationale.trim() || !input.reviewerProfileId || !input.policyVersion)
    throw new LessonKnowledgeError("assumption_invalid", "Assumption validation requires statement, rationale, reviewer, and policy.");
  if (!input.outcomeReview.evidence.length)
    throw new LessonKnowledgeError("lesson_evidence_required", "Assumption validation requires review evidence.");
  const result = freeze({
    id: `assumption-result:${input.assumption.id}:${input.outcomeReview.id}`,
    workspaceId: input.assumption.workspaceId, assumptionId: input.assumption.id,
    outcomeReviewId: input.outcomeReview.id, status: input.status,
    rationale: input.rationale, confidence: input.outcomeReview.confidence,
    evidence: input.outcomeReview.evidence, reviewedByProfileId: input.reviewerProfileId,
    policyVersion: input.policyVersion, createdAt: input.createdAt,
  });
  return freeze({ result, event: event("AssumptionValidated", result.workspaceId, result.id, input.createdAt, { outcomeReviewId: result.outcomeReviewId }) });
}

export function generateCandidateLesson(input: Omit<CandidateLessonRecord, "status">):
Readonly<{ candidate: CandidateLessonRecord; event: KnowledgeDomainEvent }> {
  requireKnowledge(input.statement, input.applicability, input.evidence, input.sourceReviewIds);
  if (!input.sourceAssumptionResultIds.length)
    throw new LessonKnowledgeError("assumption_invalid", "A candidate requires an Assumption Result.");
  const candidate = freeze({ ...input, status: "candidate" as const });
  return freeze({ candidate, event: event("CandidateLessonCreated", input.workspaceId, input.id, input.createdAt, { seriesId: input.seriesId }) });
}

export function publishLesson(input: Omit<OrganizationalLesson, "status" | "contradictionState">):
Readonly<{ lesson: OrganizationalLesson; event: KnowledgeDomainEvent }> {
  requireKnowledge(input.statement, input.applicability, input.evidence, input.sourceReviewIds);
  if (!input.sourceCandidateIds.length)
    throw new LessonKnowledgeError("lesson_evidence_required", "Published knowledge requires a candidate.");
  const lesson = freeze({ ...input, status: "validated" as const, contradictionState: "none" as const });
  return freeze({ lesson, event: event("LessonValidated", input.workspaceId, input.id, input.createdAt, { seriesId: input.seriesId }) });
}

export function reviseLesson(previous: OrganizationalLesson,
  input: Omit<OrganizationalLesson, "revision" | "supersedesLessonId" | "status" | "contradictionState">):
Readonly<{ lesson: OrganizationalLesson; relationship: LessonRelationship; event: KnowledgeDomainEvent }> {
  if (previous.workspaceId !== input.workspaceId || previous.seriesId !== input.seriesId)
    throw new LessonKnowledgeError("lesson_revision_conflict", "Lesson revisions must retain workspace and series.");
  const published = publishLesson({ ...input, revision: previous.revision + 1, supersedesLessonId: previous.id });
  const relationship = relationshipFor(previous.id, published.lesson.id, "supersedes", input, "A new immutable revision supersedes the prior lesson.");
  return freeze({ lesson: published.lesson, relationship, event: event("LessonSuperseded", input.workspaceId, input.id, input.createdAt, { supersedesLessonId: previous.id }) });
}

export function retireLesson(previous: OrganizationalLesson, input: {
  id: string; reason: string; retiredByProfileId: string; retiredAt: string; policyVersion: string;
}): Readonly<{ lesson: OrganizationalLesson; event: KnowledgeDomainEvent }> {
  if (previous.status !== "validated" || !input.reason.trim())
    throw new LessonKnowledgeError("lesson_transition_invalid", "Only validated lessons may be retired with a reason.");
  const lesson = freeze({ ...previous, id: input.id, revision: previous.revision + 1,
    status: "retired" as const, supersedesLessonId: previous.id, retiredReason: input.reason,
    retiredByProfileId: input.retiredByProfileId, retiredAt: input.retiredAt,
    policyVersion: input.policyVersion, createdAt: input.retiredAt,
    createdByProfileId: input.retiredByProfileId });
  return freeze({ lesson, event: event("LessonRetired", previous.workspaceId, lesson.id, input.retiredAt, { priorLessonId: previous.id }) });
}

export function detectContradiction(a: OrganizationalLesson, b: OrganizationalLesson,
  input: { id: string; rationale: string; evidence: readonly LearningReference[];
    policyVersion: string; createdByProfileId: string; createdAt: string;
    opposingConclusion: boolean; }):
LessonRelationship | null {
  if (a.id === b.id || a.workspaceId !== b.workspaceId) return null;
  const applicabilityOverlap = a.applicability.some(left => b.applicability.some(right =>
    left.dimension === right.dimension &&
    (!left.referenceId || !right.referenceId || left.referenceId === right.referenceId) &&
    (!left.value || !right.value || left.value === right.value)));
  if (a.category !== b.category || !applicabilityOverlap || !input.opposingConclusion) return null;
  if (!input.evidence.length || !input.rationale.trim())
    throw new LessonKnowledgeError("lesson_contradiction_invalid", "Contradictions require rationale and evidence.");
  return freeze({ id: input.id, workspaceId: a.workspaceId, fromLessonId: a.id,
    toLessonId: b.id, type: "contradicts" as const, contradictionState: "possible" as const,
    rationale: input.rationale, evidence: input.evidence, policyVersion: input.policyVersion,
    createdByProfileId: input.createdByProfileId, createdAt: input.createdAt });
}

export function mergeLessons(inputs: readonly OrganizationalLesson[], output:
  Omit<OrganizationalLesson, "status" | "contradictionState">):
Readonly<{ lesson: OrganizationalLesson; relationships: readonly LessonRelationship[] }> {
  if (inputs.length < 2 || inputs.some(item => item.workspaceId !== output.workspaceId))
    throw new LessonKnowledgeError("learning_workspace_mismatch", "Merging requires at least two same-workspace lessons.");
  const published = publishLesson(output).lesson;
  return freeze({ lesson: published, relationships: inputs.map(item =>
    relationshipFor(item.id, published.id, "merged-into", output, "Evidence and applicability were merged into a new lesson.")) });
}

function requireKnowledge(statement: string, applicability: readonly LessonApplicabilityRule[],
  evidence: readonly LearningReference[], reviews: readonly string[]) {
  if (!statement.trim()) throw new LessonKnowledgeError("assumption_invalid", "A lesson requires a statement.");
  if (!applicability.length) throw new LessonKnowledgeError("lesson_applicability_required", "A lesson cannot default to global applicability.");
  if (!evidence.length || !reviews.length) throw new LessonKnowledgeError("lesson_evidence_required", "A lesson requires evidence and source reviews.");
}
function relationshipFor(fromLessonId: string, toLessonId: string,
  type: LessonRelationship["type"], input: { id: string; workspaceId: string; policyVersion: string; createdByProfileId: string; createdAt: string; evidence: readonly LearningReference[] },
  rationale: string): LessonRelationship {
  return freeze({ id: `relationship:${fromLessonId}:${toLessonId}:${type}`, workspaceId: input.workspaceId,
    fromLessonId, toLessonId, type, contradictionState: "none", rationale,
    evidence: input.evidence, policyVersion: input.policyVersion,
    createdByProfileId: input.createdByProfileId, createdAt: input.createdAt });
}
function event(type: KnowledgeDomainEvent["type"], workspaceId: string, aggregateId: string,
  occurredAt: string, references: Record<string, string>): KnowledgeDomainEvent {
  return freeze({ id: `${type}:${aggregateId}:${occurredAt}`, type, workspaceId, aggregateId, occurredAt, references: freeze(references) });
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value); Object.values(value).forEach(freeze);
  }
  return value;
}
