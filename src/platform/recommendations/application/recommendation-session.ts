import {
  ExecutionStatus,
  type ExecutionDiagnostics,
  type ExecutionStatistics,
} from "../../execution";
import type { ObservationValue } from "../../observations";
import { RecommendationCollection } from "../domain";

export type RecommendationSessionInput = Readonly<{
  recommendations: RecommendationCollection;
  status: ExecutionStatus;
  statistics: ExecutionStatistics;
  diagnostics: ExecutionDiagnostics;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

/** Immutable outcome of recommendation policy execution. */
export class RecommendationSession {
  public readonly recommendations: RecommendationCollection;
  public readonly status: ExecutionStatus;
  public readonly statistics: ExecutionStatistics;
  public readonly diagnostics: ExecutionDiagnostics;
  public readonly metadata: Readonly<Record<string, ObservationValue>>;

  private constructor(input: RecommendationSessionInput) {
    validateStatistics(input.statistics, input.recommendations.size);
    this.recommendations = input.recommendations;
    this.status = input.status;
    this.statistics = freezeStatistics(input.statistics);
    this.diagnostics = freezeDiagnostics(input.diagnostics);
    this.metadata = Object.freeze({ ...input.metadata });
    Object.freeze(this);
  }

  public static create(input: RecommendationSessionInput): RecommendationSession {
    return new RecommendationSession(input);
  }
}

function validateStatistics(statistics: ExecutionStatistics, size: number): void {
  for (const value of [statistics.processed, statistics.succeeded, statistics.skipped, statistics.failed]) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError("Recommendation execution statistics must be non-negative integers.");
    }
  }
  if (statistics.succeeded !== size) {
    throw new RangeError("Successful recommendation count must equal collection size.");
  }
  if (statistics.succeeded + statistics.skipped + statistics.failed !== statistics.processed) {
    throw new RangeError("Recommendation execution outcomes must equal policies processed.");
  }
}

function freezeStatistics(value: ExecutionStatistics): ExecutionStatistics {
  return Object.freeze({
    ...value,
    startedAt: new Date(value.startedAt),
    ...(value.completedAt ? { completedAt: new Date(value.completedAt) } : {}),
  });
}

function freezeDiagnostics(value: ExecutionDiagnostics): ExecutionDiagnostics {
  return Object.freeze({
    warnings: Object.freeze([...value.warnings]),
    errors: Object.freeze([...value.errors]),
    skippedItems: Object.freeze([...value.skippedItems]),
    exceptions: Object.freeze([...value.exceptions]),
  });
}
