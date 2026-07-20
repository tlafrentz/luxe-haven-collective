import { ActionCollection } from "../../actions";
import type { ExecutionDiagnostics } from "../../execution";
import { WorkflowCollection } from "../../workflows";
import type { AutomationExecutionId, AutomationRuleId } from "./automation-id";
import type { PlatformEvent } from "./automation-trigger";

export const AUTOMATION_EXECUTION_STATUSES = ["succeeded", "failed", "skipped"] as const;
export type AutomationExecutionStatus = (typeof AUTOMATION_EXECUTION_STATUSES)[number];
export type AutomationOutcome = Readonly<{ successful: boolean; attempts: number; message: string }>;
export type AutomationExecutionInput = Readonly<{
  id: AutomationExecutionId;
  ruleId: AutomationRuleId;
  trigger: PlatformEvent;
  startedAt: Date;
  completedAt: Date;
  status: AutomationExecutionStatus;
  executedActions?: ActionCollection;
  executedWorkflows?: WorkflowCollection;
  diagnostics: ExecutionDiagnostics;
  outcome: AutomationOutcome;
}>;
export class AutomationExecution {
  public readonly id: AutomationExecutionId;
  public readonly ruleId: AutomationRuleId;
  public readonly trigger: PlatformEvent;
  public readonly startedAt: Date;
  public readonly completedAt: Date;
  public readonly status: AutomationExecutionStatus;
  public readonly executedActions: ActionCollection;
  public readonly executedWorkflows: WorkflowCollection;
  public readonly diagnostics: ExecutionDiagnostics;
  public readonly outcome: AutomationOutcome;
  private constructor(input: AutomationExecutionInput) {
    if (!Number.isSafeInteger(input.outcome.attempts) || input.outcome.attempts < 0) throw new RangeError("Automation attempts must be a non-negative integer.");
    this.id = input.id; this.ruleId = input.ruleId;
    this.trigger = Object.freeze({ ...input.trigger, occurredAt: date(input.trigger.occurredAt), data: Object.freeze({ ...input.trigger.data }) });
    this.startedAt = date(input.startedAt); this.completedAt = date(input.completedAt);
    if (this.completedAt < this.startedAt) throw new RangeError("Automation completion cannot precede its start.");
    this.status = input.status;
    this.executedActions = input.executedActions ?? ActionCollection.empty();
    this.executedWorkflows = input.executedWorkflows ?? WorkflowCollection.empty();
    this.diagnostics = Object.freeze({ warnings: Object.freeze([...input.diagnostics.warnings]), errors: Object.freeze([...input.diagnostics.errors]), skippedItems: Object.freeze([...input.diagnostics.skippedItems]), exceptions: Object.freeze([...input.diagnostics.exceptions]) });
    this.outcome = Object.freeze({ ...input.outcome, message: input.outcome.message.trim() });
    Object.freeze(this);
  }
  public static create(input: AutomationExecutionInput): AutomationExecution { return new AutomationExecution(input); }
}
function date(value: Date): Date { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new TypeError("Automation execution date must be valid."); return result; }
