import { Action, ActionCollection } from "../../actions";
import { ExecutionStatus, type Executor } from "../../execution";
import type { ObservationValue } from "../../observations";
import { Workflow, WorkflowCollection } from "../../workflows";
import {
  AutomationCollection,
  AutomationHistory,
  type AutomationExecution,
  type AutomationExecutionId,
  type AutomationRule,
  type PlatformEvent,
} from "../domain";
import { AutomationBuilder } from "./automation-builder";
import type { AutomationPolicyContext } from "./automation-policy";
import { AutomationPolicyRegistry } from "./automation-policy-registry";
import { AutomationSession } from "./automation-session";

export interface AutomationInvoker {
  startAction(action: Action, event: PlatformEvent): Action | Promise<Action>;
  startWorkflow(workflow: Workflow, event: PlatformEvent): Workflow | Promise<Workflow>;
}
export type AutomationExecutorInput = Readonly<{
  event: PlatformEvent;
  rules: AutomationCollection;
  actions: ActionCollection;
  workflows: WorkflowCollection;
  policies?: AutomationPolicyRegistry;
  history?: AutomationHistory;
  invoker?: AutomationInvoker;
  now?: () => Date;
  createExecutionId?: (rule: AutomationRule) => AutomationExecutionId;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;
type Prepared = Readonly<{
  rule: AutomationRule;
  context: AutomationPolicyContext;
  maxAttempts: number;
  maxConcurrency: number;
}>;

export class AutomationExecutor implements Executor<AutomationExecutorInput, AutomationSession> {
  public constructor(
    private readonly policies?: AutomationPolicyRegistry,
    private readonly builder = new AutomationBuilder(),
    private readonly invoker: AutomationInvoker = canonicalInvoker,
  ) {}

  public async execute(input: AutomationExecutorInput): Promise<AutomationSession> {
    const policies = input.policies ?? this.policies;
    if (!policies) throw new TypeError("An Automation policy registry is required.");
    const now = input.now ?? (() => new Date());
    const startedAt = date(now(), "Automation cycle start date");
    const immediate: AutomationExecution[] = [];
    const prepared: Prepared[] = [];
    for (const rule of input.rules) {
      const target = resolveTarget(rule, input.actions, input.workflows);
      const context = { rule, event: input.event, ...target };
      const skippedReason = preliminaryReason(rule, context, input.event);
      if (skippedReason) {
        immediate.push(this.skipped(rule, input.event, skippedReason, now, input));
        continue;
      }
      const governance = await govern(policies, context);
      if (!governance.allowed) {
        immediate.push(this.skipped(rule, input.event, governance.reason ?? "Automation denied by policy.", now, input));
        continue;
      }
      prepared.push({
        rule,
        context,
        maxAttempts: Math.min(rule.executionPolicy.maxAttempts ?? 1, governance.maxAttempts ?? Number.MAX_SAFE_INTEGER),
        maxConcurrency: Math.min(rule.executionPolicy.maxConcurrency ?? 1, governance.maxConcurrency ?? Number.MAX_SAFE_INTEGER),
      });
    }
    const concurrency = prepared.length ? Math.min(...prepared.map((value) => value.maxConcurrency)) : 1;
    const invoked = await runLimited(prepared, concurrency, (value) => this.invoke(value, input, now));
    const byRule = new Map([...immediate, ...invoked].map((execution) => [execution.ruleId.value, execution]));
    const cycle = AutomationHistory.create(input.rules.toArray().map((rule) => byRule.get(rule.id.value)!));
    let history = input.history ?? AutomationHistory.empty();
    for (const execution of cycle) history = history.append(execution);
    const completedAt = date(now(), "Automation cycle completion date");
    const values = cycle.toArray();
    const succeeded = values.filter((value) => value.status === "succeeded").length;
    const skipped = values.filter((value) => value.status === "skipped").length;
    const failed = values.filter((value) => value.status === "failed").length;
    const warnings = values.flatMap((value) => value.diagnostics.warnings);
    const errors = values.flatMap((value) => value.diagnostics.errors);
    const skippedItems = values.filter((value) => value.status === "skipped").map((value) => value.ruleId.value);
    const exceptions = values.filter((value) => value.status === "failed").map((value) => value.ruleId.value);
    const status = failed ? (succeeded ? ExecutionStatus.COMPLETED_WITH_WARNINGS : ExecutionStatus.FAILED)
      : (warnings.length || skipped ? ExecutionStatus.COMPLETED_WITH_WARNINGS : ExecutionStatus.COMPLETED);
    return AutomationSession.create({
      executions: cycle, history, status,
      statistics: { startedAt, completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), processed: values.length, succeeded, skipped, failed },
      diagnostics: { warnings, errors, skippedItems, exceptions }, metadata: input.metadata,
    });
  }

  private skipped(rule: AutomationRule, event: PlatformEvent, reason: string, now: () => Date, input: AutomationExecutorInput): AutomationExecution {
    const startedAt = date(now(), "Automation execution start date");
    return this.builder.buildExecution({
      ...(input.createExecutionId ? { id: input.createExecutionId(rule) } : {}), ruleId: rule.id, trigger: event,
      startedAt, completedAt: date(now(), "Automation execution completion date"), status: "skipped",
      diagnostics: { warnings: [reason], errors: [], skippedItems: [rule.id.value], exceptions: [] },
      outcome: { successful: false, attempts: 0, message: reason },
    });
  }

  private async invoke(value: Prepared, input: AutomationExecutorInput, now: () => Date): Promise<AutomationExecution> {
    const startedAt = date(now(), "Automation execution start date");
    const invoker = input.invoker ?? this.invoker;
    let lastError = "Automation failed.";
    for (let attempt = 1; attempt <= value.maxAttempts; attempt += 1) {
      try {
        const result = value.context.action
          ? { executedActions: ActionCollection.create([await invoker.startAction(value.context.action, input.event)]) }
          : { executedWorkflows: WorkflowCollection.create([await invoker.startWorkflow(value.context.workflow!, input.event)]) };
        return this.builder.buildExecution({
          ...(input.createExecutionId ? { id: input.createExecutionId(value.rule) } : {}), ruleId: value.rule.id,
          trigger: input.event, startedAt, completedAt: date(now(), "Automation execution completion date"), status: "succeeded",
          ...result, diagnostics: { warnings: [], errors: [], skippedItems: [], exceptions: [] },
          outcome: { successful: true, attempts: attempt, message: "Automation completed." },
        });
      } catch (error) { lastError = error instanceof Error ? error.message : String(error); }
    }
    return this.builder.buildExecution({
      ...(input.createExecutionId ? { id: input.createExecutionId(value.rule) } : {}), ruleId: value.rule.id,
      trigger: input.event, startedAt, completedAt: date(now(), "Automation execution completion date"), status: "failed",
      diagnostics: { warnings: [], errors: [lastError], skippedItems: [], exceptions: [value.rule.id.value] },
      outcome: { successful: false, attempts: value.maxAttempts, message: lastError },
    });
  }
}

function resolveTarget(rule: AutomationRule, actions: ActionCollection, workflows: WorkflowCollection): Pick<AutomationPolicyContext, "action" | "workflow"> {
  return rule.target.type === "action" ? { action: actions.get(rule.target.id) } : { workflow: workflows.get(rule.target.id) };
}
function preliminaryReason(rule: AutomationRule, context: AutomationPolicyContext, event: PlatformEvent): string | undefined {
  if (!rule.enabled) return "Automation rule is disabled.";
  if (!rule.trigger.matches(event)) return "Automation trigger did not match the platform event.";
  if (!rule.isScheduledFor(event.occurredAt)) return "Automation event occurred outside the execution window.";
  if (!context.action && !context.workflow) return "Automation target was not found.";
  const targetActions = context.action ? [context.action] : context.workflow!.steps.flatMap((step) => step.actions.toArray());
  if (targetActions.length === 0 || targetActions.some((action) => action.decisionIds.length === 0)) {
    return "Automation cannot bypass Decision provenance.";
  }
  if (!rule.conditions.every((condition) => condition.evaluate(context))) return "Automation conditions were not satisfied.";
  return undefined;
}
async function govern(registry: AutomationPolicyRegistry, context: AutomationPolicyContext) {
  let maxAttempts: number | undefined, maxConcurrency: number | undefined;
  for (const policy of registry) {
    if (!(await policy.supports(context))) continue;
    const result = await policy.govern(context);
    if (!result.allowed) return { allowed: false, reason: result.reason, maxAttempts, maxConcurrency };
    if (result.maxAttempts !== undefined) maxAttempts = Math.min(maxAttempts ?? result.maxAttempts, positive(result.maxAttempts, "Policy max attempts"));
    if (result.maxConcurrency !== undefined) maxConcurrency = Math.min(maxConcurrency ?? result.maxConcurrency, positive(result.maxConcurrency, "Policy max concurrency"));
  }
  return { allowed: true, maxAttempts, maxConcurrency };
}
function positive(value: number, field: string): number { if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${field} must be a positive integer.`); return value; }
async function runLimited<T, TResult>(values: readonly T[], limit: number, operation: (value: T) => Promise<TResult>): Promise<TResult[]> {
  const results = new Array<TResult>(values.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (next < values.length) { const index = next; next += 1; results[index] = await operation(values[index]); }
  }));
  return results;
}
const canonicalInvoker: AutomationInvoker = {
  startAction(action, event) {
    if (action.status === "proposed") return action.accept(event.occurredAt).start(event.occurredAt);
    return action.start(event.occurredAt);
  },
  startWorkflow(workflow, event) {
    if (workflow.status !== "ready" && workflow.status !== "pending") throw new Error(`Cannot start workflow with status "${workflow.status}".`);
    return workflow.withStatus("active", event.occurredAt, "Started by automation.");
  },
};
function date(value: Date, field: string): Date { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new TypeError(`${field} must be valid.`); return result; }
