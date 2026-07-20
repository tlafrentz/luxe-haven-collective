import { ExecutionStatus, type ExecutionDiagnostics, type ExecutionStatistics } from "../../execution";
import type { ObservationValue } from "../../observations";
import { AutomationHistory } from "../domain";

export type AutomationSessionInput = Readonly<{
  executions: AutomationHistory;
  history: AutomationHistory;
  status: ExecutionStatus;
  statistics: ExecutionStatistics;
  diagnostics: ExecutionDiagnostics;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;
export class AutomationSession {
  public readonly executions: AutomationHistory;
  public readonly history: AutomationHistory;
  public readonly status: ExecutionStatus;
  public readonly statistics: ExecutionStatistics;
  public readonly diagnostics: ExecutionDiagnostics;
  public readonly metadata: Readonly<Record<string, ObservationValue>>;
  private constructor(input: AutomationSessionInput) {
    const outcomes = input.executions.toArray();
    if (input.statistics.processed !== outcomes.length ||
        input.statistics.succeeded !== outcomes.filter((value) => value.status === "succeeded").length ||
        input.statistics.skipped !== outcomes.filter((value) => value.status === "skipped").length ||
        input.statistics.failed !== outcomes.filter((value) => value.status === "failed").length) {
      throw new RangeError("Automation execution statistics must match cycle executions.");
    }
    this.executions = input.executions; this.history = input.history; this.status = input.status;
    this.statistics = Object.freeze({ ...input.statistics, startedAt: new Date(input.statistics.startedAt), ...(input.statistics.completedAt ? { completedAt: new Date(input.statistics.completedAt) } : {}) });
    this.diagnostics = Object.freeze({ warnings: Object.freeze([...input.diagnostics.warnings]), errors: Object.freeze([...input.diagnostics.errors]), skippedItems: Object.freeze([...input.diagnostics.skippedItems]), exceptions: Object.freeze([...input.diagnostics.exceptions]) });
    this.metadata = Object.freeze({ ...input.metadata }); Object.freeze(this);
  }
  public static create(input: AutomationSessionInput): AutomationSession { return new AutomationSession(input); }
}
