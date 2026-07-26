import {
  detectContradiction, generateCandidateLesson, mergeLessons, publishLesson,
  retireLesson, reviseLesson, validateAssumption,
  type CandidateLessonRecord, type KnowledgeDomainEvent, type LearningAssumption,
  type LessonRelationship, type OrganizationalLesson, type ValidatedAssumptionResult,
} from "../domain";

export interface LessonKnowledgeRepository {
  appendAssumption(assumption: LearningAssumption): Promise<void>;
  appendAssumptionResult(result: ValidatedAssumptionResult): Promise<void>;
  appendCandidate(candidate: CandidateLessonRecord): Promise<void>;
  appendLesson(lesson: OrganizationalLesson): Promise<void>;
  appendRelationship(relationship: LessonRelationship): Promise<void>;
  appendEvents(events: readonly KnowledgeDomainEvent[]): Promise<void>;
  getLesson(workspaceId: string, id: string): Promise<OrganizationalLesson | null>;
  listLessons(workspaceId: string, category?: OrganizationalLesson["category"]): Promise<readonly OrganizationalLesson[]>;
}

export async function validateAssumptionRecord(repository: LessonKnowledgeRepository,
  input: Parameters<typeof validateAssumption>[0]) {
  const result = validateAssumption(input);
  await repository.appendAssumption(input.assumption);
  await repository.appendAssumptionResult(result.result);
  await repository.appendEvents([result.event]);
  return result.result;
}

export async function createCandidateLessonRecord(repository: LessonKnowledgeRepository,
  input: Parameters<typeof generateCandidateLesson>[0]) {
  const result = generateCandidateLesson(input);
  await repository.appendCandidate(result.candidate);
  await repository.appendEvents([result.event]);
  return result.candidate;
}

export async function publishLessonRecord(repository: LessonKnowledgeRepository,
  input: Parameters<typeof publishLesson>[0]) {
  const result = publishLesson(input);
  await repository.appendLesson(result.lesson);
  await repository.appendEvents([result.event]);
  return result.lesson;
}

export async function reviseLessonRecord(repository: LessonKnowledgeRepository,
  previous: OrganizationalLesson, input: Parameters<typeof reviseLesson>[1]) {
  const result = reviseLesson(previous, input);
  await repository.appendLesson(result.lesson);
  await repository.appendRelationship(result.relationship);
  await repository.appendEvents([result.event]);
  return result.lesson;
}

export async function retireLessonRecord(repository: LessonKnowledgeRepository,
  previous: OrganizationalLesson, input: Parameters<typeof retireLesson>[1]) {
  const result = retireLesson(previous, input);
  await repository.appendLesson(result.lesson);
  await repository.appendEvents([result.event]);
  return result.lesson;
}

export async function detectLessonContradictions(repository: LessonKnowledgeRepository,
  lesson: OrganizationalLesson, input: {
    idFor(other: OrganizationalLesson): string; rationale: string;
    evidence: OrganizationalLesson["evidence"]; policyVersion: string;
    createdByProfileId: string; createdAt: string;
    isOpposing(other: OrganizationalLesson): boolean;
  }) {
  const existing = await repository.listLessons(lesson.workspaceId, lesson.category);
  const relationships = existing.flatMap(other => {
    const relation = detectContradiction(lesson, other, {
      id: input.idFor(other), rationale: input.rationale, evidence: input.evidence,
      policyVersion: input.policyVersion, createdByProfileId: input.createdByProfileId,
      createdAt: input.createdAt, opposingConclusion: input.isOpposing(other),
    });
    return relation ? [relation] : [];
  });
  for (const relationship of relationships) await repository.appendRelationship(relationship);
  if (relationships.length) await repository.appendEvents([{
    id: `LessonContradicted:${lesson.id}:${input.createdAt}`, type: "LessonContradicted",
    workspaceId: lesson.workspaceId, aggregateId: lesson.id, occurredAt: input.createdAt,
    references: Object.freeze({ count: String(relationships.length) }),
  }]);
  return Object.freeze(relationships);
}

export async function mergeLessonRecords(repository: LessonKnowledgeRepository,
  inputs: readonly OrganizationalLesson[], output: Parameters<typeof mergeLessons>[1]) {
  const result = mergeLessons(inputs, output);
  await repository.appendLesson(result.lesson);
  for (const relationship of result.relationships) await repository.appendRelationship(relationship);
  return result.lesson;
}

export const getLesson = (repository: LessonKnowledgeRepository, workspaceId: string, id: string) =>
  repository.getLesson(workspaceId, id);
