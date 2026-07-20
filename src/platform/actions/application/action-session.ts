import { ExecutionStatus, type ExecutionDiagnostics, type ExecutionStatistics } from "../../execution";
import type { ObservationValue } from "../../observations";
import { ActionCollection } from "../domain";

export type ActionSessionInput = Readonly<{
  actions: ActionCollection;
  status: ExecutionStatus;
  statistics: ExecutionStatistics;
  diagnostics: ExecutionDiagnostics;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;
export class ActionSession {
  public readonly actions: ActionCollection;
  public readonly status: ExecutionStatus;
  public readonly statistics: ExecutionStatistics;
  public readonly diagnostics: ExecutionDiagnostics;
  public readonly metadata: Readonly<Record<string, ObservationValue>>;
  private constructor(input: ActionSessionInput) {
    if (input.statistics.succeeded !== input.actions.size ||
        input.statistics.succeeded + input.statistics.skipped + input.statistics.failed !== input.statistics.processed) {
      throw new RangeError("Action execution outcomes must match policies processed.");
    }
    this.actions = input.actions;
    this.status = input.status;
    this.statistics = Object.freeze({ ...input.statistics, startedAt: new Date(input.statistics.startedAt), ...(input.statistics.completedAt ? { completedAt: new Date(input.statistics.completedAt) } : {}) });
    this.diagnostics = Object.freeze({ warnings: Object.freeze([...input.diagnostics.warnings]), errors: Object.freeze([...input.diagnostics.errors]), skippedItems: Object.freeze([...input.diagnostics.skippedItems]), exceptions: Object.freeze([...input.diagnostics.exceptions]) });
    this.metadata = Object.freeze({ ...input.metadata });
    Object.freeze(this);
  }
  public static create(input: ActionSessionInput): ActionSession { return new ActionSession(input); }
}
