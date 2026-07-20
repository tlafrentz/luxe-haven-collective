import { ExecutionStatus, type ExecutionDiagnostics, type ExecutionStatistics } from "../../execution";
import type { ObservationValue } from "../../observations";
import { WorkflowCollection } from "../domain";

export type WorkflowSessionInput = Readonly<{
  workflows: WorkflowCollection;
  status: ExecutionStatus;
  statistics: ExecutionStatistics;
  diagnostics: ExecutionDiagnostics;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;
export class WorkflowSession {
  public readonly workflows: WorkflowCollection;
  public readonly status: ExecutionStatus;
  public readonly statistics: ExecutionStatistics;
  public readonly diagnostics: ExecutionDiagnostics;
  public readonly metadata: Readonly<Record<string, ObservationValue>>;
  private constructor(input: WorkflowSessionInput) {
    for (const value of [input.statistics.processed, input.statistics.succeeded, input.statistics.skipped, input.statistics.failed]) {
      if (!Number.isSafeInteger(value) || value < 0) throw new RangeError("Workflow execution statistics must be non-negative integers.");
    }
    if (input.statistics.succeeded !== input.workflows.size ||
        input.statistics.succeeded + input.statistics.skipped + input.statistics.failed !== input.statistics.processed) {
      throw new RangeError("Workflow execution outcomes must match definitions processed.");
    }
    this.workflows = input.workflows;
    this.status = input.status;
    this.statistics = Object.freeze({ ...input.statistics, startedAt: new Date(input.statistics.startedAt), ...(input.statistics.completedAt ? { completedAt: new Date(input.statistics.completedAt) } : {}) });
    this.diagnostics = Object.freeze({ warnings: Object.freeze([...input.diagnostics.warnings]), errors: Object.freeze([...input.diagnostics.errors]), skippedItems: Object.freeze([...input.diagnostics.skippedItems]), exceptions: Object.freeze([...input.diagnostics.exceptions]) });
    this.metadata = Object.freeze({ ...input.metadata });
    Object.freeze(this);
  }
  public static create(input: WorkflowSessionInput): WorkflowSession { return new WorkflowSession(input); }
}
