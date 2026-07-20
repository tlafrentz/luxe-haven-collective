import { ExecutionStatus, type ExecutionDiagnostics, type ExecutionStatistics } from "../../execution";
import type { ObservationValue } from "../../observations";
import { OutcomeCollection } from "../domain";

export type OutcomeSessionInput = Readonly<{
  outcomes: OutcomeCollection; status: ExecutionStatus; statistics: ExecutionStatistics;
  diagnostics: ExecutionDiagnostics; metadata?: Readonly<Record<string, ObservationValue>>;
}>;
export class OutcomeSession {
  public readonly outcomes: OutcomeCollection;
  public readonly status: ExecutionStatus;
  public readonly statistics: ExecutionStatistics;
  public readonly diagnostics: ExecutionDiagnostics;
  public readonly metadata: Readonly<Record<string, ObservationValue>>;
  private constructor(input: OutcomeSessionInput) {
    for (const value of [input.statistics.processed, input.statistics.succeeded, input.statistics.skipped, input.statistics.failed]) {
      if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("Outcome execution statistics must be non-negative integers.");
    }
    if (input.statistics.succeeded !== input.outcomes.size || input.statistics.succeeded + input.statistics.skipped + input.statistics.failed !== input.statistics.processed) {
      throw new RangeError("Outcome execution statistics must match sources processed.");
    }
    this.outcomes = input.outcomes; this.status = input.status;
    this.statistics = Object.freeze({ ...input.statistics, startedAt: new Date(input.statistics.startedAt), ...(input.statistics.completedAt ? { completedAt: new Date(input.statistics.completedAt) } : {}) });
    this.diagnostics = Object.freeze({ warnings: Object.freeze([...input.diagnostics.warnings]), errors: Object.freeze([...input.diagnostics.errors]), skippedItems: Object.freeze([...input.diagnostics.skippedItems]), exceptions: Object.freeze([...input.diagnostics.exceptions]) });
    this.metadata = Object.freeze({ ...input.metadata }); Object.freeze(this);
  }
  public static create(input: OutcomeSessionInput): OutcomeSession { return new OutcomeSession(input); }
}
