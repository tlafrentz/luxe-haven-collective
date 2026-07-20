import type { ActionCollection } from "../../actions";
import type { ExecutionDiagnostics } from "../../execution";
import type { WorkflowCollection } from "../../workflows";
import {
  AutomationCondition,
  AutomationExecution,
  AutomationRule,
  AutomationTrigger,
  createAutomationExecutionId,
  type AutomationConditionInput,
  type AutomationExecutionId,
  type AutomationExecutionPolicy,
  type AutomationOutcome,
  type AutomationRuleId,
  type AutomationTarget,
  type AutomationTriggerInput,
  type PlatformEvent,
} from "../domain";
import type { ObservationValue } from "../../observations";

export type AutomationRuleBuilderInput = Readonly<{
  id: AutomationRuleId; title: string; description: string; enabled?: boolean;
  trigger: AutomationTriggerInput; conditions?: readonly AutomationConditionInput[];
  target: AutomationTarget; executionPolicy?: AutomationExecutionPolicy;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;
export type AutomationExecutionBuilderInput = Readonly<{
  id?: AutomationExecutionId; ruleId: AutomationRuleId; trigger: PlatformEvent;
  startedAt: Date; completedAt: Date; status: "succeeded" | "failed" | "skipped";
  executedActions?: ActionCollection; executedWorkflows?: WorkflowCollection;
  diagnostics: ExecutionDiagnostics; outcome: AutomationOutcome;
}>;

export class AutomationBuilder {
  public buildRule(input: AutomationRuleBuilderInput): AutomationRule {
    return AutomationRule.create({
      ...input,
      trigger: AutomationTrigger.create(input.trigger),
      conditions: input.conditions?.map((condition) => AutomationCondition.create(condition)),
    });
  }
  public buildExecution(input: AutomationExecutionBuilderInput): AutomationExecution {
    return AutomationExecution.create({ ...input, id: input.id ?? createAutomationExecutionId() });
  }
}
