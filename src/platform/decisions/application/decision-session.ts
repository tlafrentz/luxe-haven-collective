import {
  ExecutionStatus,
  type ExecutionDiagnostics,
  type ExecutionStatistics,
} from "../../execution";
import type { ObservationValue } from "../../observations";
import { DecisionCollection } from "../domain/decision-collection";

export type DecisionSessionInput = Readonly<{
  decisions: DecisionCollection;
  status: ExecutionStatus;
  statistics: ExecutionStatistics;
  diagnostics: ExecutionDiagnostics;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

export class DecisionSession {
  public readonly decisions: DecisionCollection;
  public readonly status: ExecutionStatus;
  public readonly statistics: ExecutionStatistics;
  public readonly diagnostics: ExecutionDiagnostics;
  public readonly metadata: Readonly<Record<string, ObservationValue>>;

  private constructor(input: DecisionSessionInput) {
    validate(input.statistics, input.decisions.size);
    this.decisions = input.decisions;
    this.status = input.status;
    this.statistics = Object.freeze({
      ...input.statistics,
      startedAt: new Date(input.statistics.startedAt),
      ...(input.statistics.completedAt
        ? { completedAt: new Date(input.statistics.completedAt) }
        : {}),
    });
    this.diagnostics = Object.freeze({
      warnings: Object.freeze([...input.diagnostics.warnings]),
      errors: Object.freeze([...input.diagnostics.errors]),
      skippedItems: Object.freeze([...input.diagnostics.skippedItems]),
      exceptions: Object.freeze([...input.diagnostics.exceptions]),
    });
    this.metadata = Object.freeze({ ...input.metadata });
    Object.freeze(this);
  }

  public static create(input: DecisionSessionInput): DecisionSession {
    return new DecisionSession(input);
  }
}

function validate(statistics: ExecutionStatistics, size: number): void {
  for (const value of [statistics.processed, statistics.succeeded, statistics.skipped, statistics.failed]) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError("Decision execution statistics must be non-negative integers.");
    }
  }
  if (statistics.succeeded !== size) {
    throw new RangeError("Successful Decision count must equal collection size.");
  }
  if (statistics.succeeded + statistics.skipped + statistics.failed !== statistics.processed) {
    throw new RangeError("Decision execution outcomes must equal policies processed.");
  }
}
