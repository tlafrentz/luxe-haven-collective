import { Result, type ResultType } from "@/platform/kernel";
import { Outcome, type OutcomeId, type OutcomeOrigin, type OutcomeOwnerId, type OutcomeState, type OutcomeSubject } from "../domain";
import type {
  OutcomePage, OutcomeReadModel, OutcomeReader, OutcomeRepository, OutcomeRepositoryError,
} from "../application";

export class InMemoryOutcomeRepository implements OutcomeRepository, OutcomeReader {
  private readonly records = new Map<string, OutcomeState>();

  public async findById(ownerId: OutcomeOwnerId, outcomeId: OutcomeId): Promise<ResultType<Outcome | null, OutcomeRepositoryError>> {
    const state = this.records.get(outcomeId.value);
    return Result.ok(state && state.ownerId.equals(ownerId) ? Outcome.restore(state) : null);
  }

  public async save(outcome: Outcome, expectedVersion: number | null): Promise<ResultType<void, OutcomeRepositoryError>> {
    const current = this.records.get(outcome.id.value);
    if (!current) {
      if (expectedVersion !== null) return Result.fail({ code: "OUTCOME_VERSION_CONFLICT" });
      this.records.set(outcome.id.value, outcome.props);
      return Result.ok(undefined);
    }
    if (expectedVersion === null) return Result.fail({ code: "OUTCOME_DUPLICATE_ID" });
    if (current.version !== expectedVersion) return Result.fail({ code: "OUTCOME_VERSION_CONFLICT", currentVersion: current.version });
    if (!current.ownerId.equals(outcome.ownerId)) return Result.fail({ code: "OUTCOME_VERSION_CONFLICT", currentVersion: current.version });
    this.records.set(outcome.id.value, outcome.props);
    return Result.ok(undefined);
  }

  public async existsByOrigin(ownerId: OutcomeOwnerId, origin: OutcomeOrigin): Promise<ResultType<boolean, OutcomeRepositoryError>> {
    const target = originKey(origin);
    return Result.ok([...this.records.values()].some(state => state.ownerId.equals(ownerId) && originKey(state.origin) === target));
  }

  public async getOutcome(query: Readonly<{ ownerId: OutcomeOwnerId; outcomeId: OutcomeId }>): Promise<ResultType<OutcomeReadModel | null, OutcomeRepositoryError>> {
    const result = await this.findById(query.ownerId, query.outcomeId);
    return result.isFailure ? result : Result.ok(result.value ? project(result.value.props) : null);
  }

  public async listOutcomesForDecision(query: Readonly<{ ownerId: OutcomeOwnerId; decisionId: string; limit: number; cursor?: string }>): Promise<ResultType<OutcomePage, OutcomeRepositoryError>> {
    return Result.ok(this.page(query.ownerId, query.limit, query.cursor, state =>
      state.lineage.decisionReferences.some(reference => reference.decisionId === query.decisionId)
      || ("decisionId" in state.origin && state.origin.decisionId === query.decisionId)
      || ("investmentDecisionId" in state.origin && state.origin.investmentDecisionId === query.decisionId)));
  }

  public async listOutcomesForSubject(query: Readonly<{ ownerId: OutcomeOwnerId; subject: OutcomeSubject; limit: number; cursor?: string }>): Promise<ResultType<OutcomePage, OutcomeRepositoryError>> {
    return Result.ok(this.page(query.ownerId, query.limit, query.cursor, state => subjectKey(state.subject) === subjectKey(query.subject)));
  }

  private page(ownerId: OutcomeOwnerId, requestedLimit: number, cursor: string | undefined, predicate: (state: OutcomeState) => boolean): OutcomePage {
    const limit = boundedLimit(requestedLimit);
    const values = [...this.records.values()]
      .filter(state => state.ownerId.equals(ownerId) && predicate(state))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.id.value.localeCompare(b.id.value));
    const offset = cursor ? cursorOffset(cursor) : 0;
    const items = values.slice(offset, offset + limit).map(project);
    return Object.freeze({
      items: Object.freeze(items),
      ...(offset + limit < values.length ? { nextCursor: String(offset + limit) } : {}),
    });
  }
}

function project(state: OutcomeState): OutcomeReadModel {
  const counts = { planned: 0, open: 0, closed: 0, cancelled: 0 };
  for (const window of state.measurementPlan.windows) counts[window.status] += 1;
  return Object.freeze({
    id: state.id, subject: Object.freeze({ ...state.subject }), origin: Object.freeze({ ...state.origin }),
    status: state.status, expectationCount: state.expectations.length, measurementCount: state.measurements.length,
    measurementWindowSummary: Object.freeze(counts), confidence: state.confidence.assessment,
    createdAt: new Date(state.createdAt), updatedAt: new Date(state.updatedAt), version: state.version,
  });
}
function originKey(origin: OutcomeOrigin): string {
  return Object.entries(origin).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${String(value)}`).join("|");
}
function subjectKey(subject: OutcomeSubject): string {
  return Object.entries(subject).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${String(value)}`).join("|");
}
function boundedLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new RangeError("Outcome query limit must be between 1 and 100.");
  return limit;
}
function cursorOffset(cursor: string): number {
  const value = Number(cursor);
  if (!Number.isInteger(value) || value < 0) throw new TypeError("Outcome cursor is invalid.");
  return value;
}
