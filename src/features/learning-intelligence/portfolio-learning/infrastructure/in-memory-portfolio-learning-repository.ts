import { Result, type ResultType } from "@/platform/kernel";
import type { OutcomeOwnerId } from "../../outcomes";
import type { PortfolioLearningAssessmentRepository, PortfolioLearningRepositoryError } from "../application";
import type { PortfolioLearningAssessment, PortfolioLearningAssessmentId } from "../domain";

export class InMemoryPortfolioLearningAssessmentRepository implements PortfolioLearningAssessmentRepository {
  private readonly records = new Map<string, PortfolioLearningAssessment>();
  public async save(value: PortfolioLearningAssessment, expectedVersion: number | null): Promise<ResultType<void, PortfolioLearningRepositoryError>> {
    if (this.records.has(value.id.value)) return Result.fail({ code: "PORTFOLIO_LEARNING_DUPLICATE_ID" });
    const latest = this.latest(value.ownerId, value.portfolioId);
    if ((latest?.version ?? null) !== expectedVersion || value.version !== (expectedVersion ?? 0) + 1) return Result.fail({ code: "PORTFOLIO_LEARNING_VERSION_CONFLICT", ...(latest ? { currentVersion: latest.version } : {}) });
    this.records.set(value.id.value, clone(value)); return Result.ok(undefined);
  }
  public async findLatest(ownerId: OutcomeOwnerId, portfolioId: string): Promise<ResultType<PortfolioLearningAssessment | null, PortfolioLearningRepositoryError>> {
    const value = this.latest(ownerId, portfolioId); return Result.ok(value ? clone(value) : null);
  }
  public async findById(ownerId: OutcomeOwnerId, id: PortfolioLearningAssessmentId): Promise<ResultType<PortfolioLearningAssessment | null, PortfolioLearningRepositoryError>> {
    const value = this.records.get(id.value); return Result.ok(value && value.ownerId.equals(ownerId) ? clone(value) : null);
  }
  private latest(ownerId: OutcomeOwnerId, portfolioId: string) {
    return [...this.records.values()].filter(value => value.ownerId.equals(ownerId) && value.portfolioId === portfolioId)
      .sort((a, b) => b.version - a.version || b.evaluatedAt.getTime() - a.evaluatedAt.getTime() || b.id.value.localeCompare(a.id.value))[0];
  }
}
function clone(value: PortfolioLearningAssessment): PortfolioLearningAssessment {
  return Object.freeze({ ...value, evaluatedAt: new Date(value.evaluatedAt), observationWindow: Object.freeze({ start: new Date(value.observationWindow.start), end: new Date(value.observationWindow.end) }), learnings: Object.freeze([...value.learnings]), candidates: Object.freeze([...value.candidates]), changes: Object.freeze([...value.changes]), limitations: Object.freeze([...value.limitations]) });
}
