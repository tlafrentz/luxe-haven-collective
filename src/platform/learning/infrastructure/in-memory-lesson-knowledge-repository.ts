import type { LessonKnowledgeRepository } from "../application";
import type {
  CandidateLessonRecord, KnowledgeDomainEvent, LearningAssumption,
  LessonRelationship, OrganizationalLesson, ValidatedAssumptionResult,
} from "../domain";

export class InMemoryLessonKnowledgeRepository implements LessonKnowledgeRepository {
  readonly assumptions: LearningAssumption[] = [];
  readonly results: ValidatedAssumptionResult[] = [];
  readonly candidates: CandidateLessonRecord[] = [];
  readonly lessons: OrganizationalLesson[] = [];
  readonly relationships: LessonRelationship[] = [];
  readonly events: KnowledgeDomainEvent[] = [];
  async appendAssumption(value: LearningAssumption) {
    if (!this.assumptions.some(item => item.id === value.id)) this.assumptions.push(value);
  }
  async appendAssumptionResult(value: ValidatedAssumptionResult) { this.results.push(value); }
  async appendCandidate(value: CandidateLessonRecord) { this.candidates.push(value); }
  async appendLesson(value: OrganizationalLesson) { this.lessons.push(value); }
  async appendRelationship(value: LessonRelationship) { this.relationships.push(value); }
  async appendEvents(values: readonly KnowledgeDomainEvent[]) { this.events.push(...values); }
  async getLesson(workspaceId: string, id: string) {
    return this.lessons.find(item => item.workspaceId === workspaceId && item.id === id) ?? null;
  }
  async listLessons(workspaceId: string, category?: OrganizationalLesson["category"]) {
    return this.lessons.filter(item => item.workspaceId === workspaceId &&
      (!category || item.category === category));
  }
}
