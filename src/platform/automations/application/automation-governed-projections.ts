import type { AutomationActor } from "../domain/automation-definition";
import type { AutomationApproval, AutomationRun, AutomationRunStep } from "../domain/automation-governed-execution";

export type AutomationRunProjection = Readonly<{ projectionVersion: "au001c-run.v1"; generatedAt: string; run: AutomationRun; steps: readonly AutomationRunStep[]; approvals: readonly AutomationApproval[]; completedSteps: number; totalSteps: number; reconciliationRequired: boolean; validCommands: readonly string[] }>;
export function projectAutomationRun(input: Readonly<{ run: AutomationRun; steps: readonly AutomationRunStep[]; approvals?: readonly AutomationApproval[]; actor: AutomationActor; generatedAt: string }>): AutomationRunProjection {
  const authorized = input.actor.active && input.actor.tenantId === input.run.tenantId && (input.actor.role !== "operator" || input.run.propertyIds.every((id) => input.actor.propertyIds.includes(id)));
  if (!authorized) throw new Error("Automation run projection access denied.");
  const commands: string[] = [];
  if (input.run.status === "awaiting_approval" && ["owner", "administrator"].includes(input.actor.role)) commands.push("approve", "reject", "defer", "request_revision");
  if (["queued", "running"].includes(input.run.status) && ["owner", "administrator", "operator"].includes(input.actor.role)) commands.push("request_cancellation");
  if (input.steps.some(({ status }) => status === "failed_retryable")) commands.push("retry");
  if (input.steps.some(({ status }) => status === "reconciliation_required")) commands.push("reconcile");
  return Object.freeze({ projectionVersion: "au001c-run.v1", generatedAt: input.generatedAt, run: input.run, steps: Object.freeze([...input.steps]), approvals: Object.freeze([...(input.approvals ?? [])]), completedSteps: input.steps.filter(({ status }) => ["succeeded", "skipped", "compensated"].includes(status)).length, totalSteps: input.steps.length, reconciliationRequired: input.steps.some(({ status }) => status === "reconciliation_required"), validCommands: Object.freeze([...new Set(commands)]) });
}
