import { Result, type ResultType } from "@/platform/kernel";
import type { OutcomeId, OutcomeOwnerId } from "../../outcomes";
import type {
  DecisionOutcomeAssessmentRepository, DecisionOutcomeRepositoryError,
} from "../application";
import type { DecisionOutcomeAssessment, DecisionOutcomeAssessmentId } from "../domain";

export class InMemoryDecisionOutcomeAssessmentRepository implements DecisionOutcomeAssessmentRepository {
  private readonly records = new Map<string, DecisionOutcomeAssessment>();

  public async findById(ownerId: OutcomeOwnerId, assessmentId: DecisionOutcomeAssessmentId): Promise<ResultType<DecisionOutcomeAssessment | null, DecisionOutcomeRepositoryError>> {
    const value = this.records.get(assessmentId.value);
    return Result.ok(value && value.ownerId.equals(ownerId) ? cloneAssessment(value) : null);
  }
  public async findLatestByOutcome(ownerId: OutcomeOwnerId, outcomeId: OutcomeId): Promise<ResultType<DecisionOutcomeAssessment | null, DecisionOutcomeRepositoryError>> {
    const value = [...this.records.values()].filter(item => item.ownerId.equals(ownerId) && item.outcomeId.equals(outcomeId))
      .sort((a, b) => b.version - a.version || b.evaluatedAt.getTime() - a.evaluatedAt.getTime() || b.id.value.localeCompare(a.id.value))[0];
    return Result.ok(value ? cloneAssessment(value) : null);
  }
  public async save(assessment: DecisionOutcomeAssessment, expectedVersion: number | null): Promise<ResultType<void, DecisionOutcomeRepositoryError>> {
    const existingId = this.records.get(assessment.id.value);
    if (existingId) return Result.fail({ code: "ASSESSMENT_DUPLICATE_ID" });
    const latest = [...this.records.values()].filter(item => item.ownerId.equals(assessment.ownerId) && item.outcomeId.equals(assessment.outcomeId))
      .sort((a, b) => b.version - a.version)[0];
    if ((latest?.version ?? null) !== expectedVersion) return Result.fail({ code: "ASSESSMENT_VERSION_CONFLICT", ...(latest ? { currentVersion: latest.version } : {}) });
    if (assessment.version !== (expectedVersion ?? 0) + 1) return Result.fail({ code: "ASSESSMENT_VERSION_CONFLICT", ...(latest ? { currentVersion: latest.version } : {}) });
    this.records.set(assessment.id.value, cloneAssessment(assessment));
    return Result.ok(undefined);
  }
}
function cloneAssessment(value: DecisionOutcomeAssessment): DecisionOutcomeAssessment {
  return Object.freeze({
    ...value, evaluatedAt: new Date(value.evaluatedAt),
    objectives: Object.freeze([...value.objectives]), unexpectedEffects: Object.freeze([...value.unexpectedEffects]),
    decisionReferences: Object.freeze(value.decisionReferences.map(item => Object.freeze({ ...item }))),
    events: Object.freeze(value.events.map(item => Object.freeze({ ...item, occurredAt: new Date(item.occurredAt), references: Object.freeze({ ...item.references }) }))),
  });
}
