export interface ExecutionStatistics {
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly durationMs?: number;
  readonly processed: number;
  readonly succeeded: number;
  readonly skipped: number;
  readonly failed: number;
}
