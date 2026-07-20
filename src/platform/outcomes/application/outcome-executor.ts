import { ActionCollection } from "../../actions";
import { AutomationHistory } from "../../automations";
import { ExecutionStatus, type Executor } from "../../execution";
import type { ObservationValue } from "../../observations";
import { WorkflowCollection } from "../../workflows";
import { OutcomeCollection, type OutcomeId } from "../domain";
import { OutcomeBuilder } from "./outcome-builder";
import type { OutcomePolicy, OutcomeSource } from "./outcome-policy";
import { OutcomePolicyRegistry } from "./outcome-policy-registry";
import { OutcomeSession } from "./outcome-session";

export type OutcomeExecutorInput = Readonly<{
  actions: ActionCollection;
  workflows: WorkflowCollection;
  automations: AutomationHistory;
  policies?: OutcomePolicyRegistry;
  now?: () => Date;
  createOutcomeId?: (source: OutcomeSource, policy: OutcomePolicy) => OutcomeId;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;
export class OutcomeExecutor implements Executor<OutcomeExecutorInput, OutcomeSession> {
  public constructor(private readonly policies?: OutcomePolicyRegistry, private readonly builder = new OutcomeBuilder()) {}
  public async execute(input: OutcomeExecutorInput): Promise<OutcomeSession> {
    const policies = input.policies ?? this.policies;
    if (!policies) throw new TypeError("An Outcome policy registry is required.");
    const now = input.now ?? (() => new Date()); const startedAt = date(now(), "Outcome execution start date");
    const sources = collectSources(input); let outcomes = OutcomeCollection.empty();
    const warnings: string[] = [], errors: string[] = [], skippedItems: string[] = [], exceptions: string[] = [];
    for (const source of sources) {
      const label = sourceLabel(source);
      try {
        const policy = await resolvePolicy(policies, source);
        if (!policy) { skippedItems.push(label); warnings.push(`No Outcome policy supports ${label}.`); continue; }
        const result = await policy.measure({ source });
        if (!result) { skippedItems.push(label); warnings.push(`Outcome policy "${policy.name}" produced no Outcome for ${label}.`); continue; }
        outcomes = outcomes.add(this.builder.build({ source, result, ...(input.createOutcomeId ? { id: input.createOutcomeId(source, policy) } : {}), metadata: { policy: policy.name, ...(policy.version ? { policyVersion: policy.version } : {}) } }));
      } catch (error) {
        errors.push(`Outcome generation failed for ${label}: ${error instanceof Error ? error.message : String(error)}`); exceptions.push(label);
      }
    }
    const completedAt = date(now(), "Outcome execution completion date"), failed = exceptions.length;
    const status = failed ? (outcomes.isEmpty ? ExecutionStatus.FAILED : ExecutionStatus.COMPLETED_WITH_WARNINGS)
      : (warnings.length ? ExecutionStatus.COMPLETED_WITH_WARNINGS : ExecutionStatus.COMPLETED);
    return OutcomeSession.create({ outcomes, status,
      statistics: { startedAt, completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), processed: sources.length, succeeded: outcomes.size, skipped: skippedItems.length, failed },
      diagnostics: { warnings, errors, skippedItems, exceptions }, metadata: input.metadata,
    });
  }
}
function collectSources(input: OutcomeExecutorInput): OutcomeSource[] {
  const actions: OutcomeSource[] = input.actions.toArray()
    .filter((value) => value.status === "completed" || value.status === "measured" || (value.status === "archived" && value.completedAt))
    .map((action) => ({ type: "action", action }));
  const workflows: OutcomeSource[] = input.workflows.toArray().filter((value) => value.status === "completed" || value.status === "cancelled").map((workflow) => ({ type: "workflow", workflow }));
  const automations: OutcomeSource[] = input.automations.toArray().filter((value) => value.status !== "skipped").map((automation) => ({ type: "automation", automation }));
  return [...actions, ...workflows, ...automations];
}
async function resolvePolicy(registry: OutcomePolicyRegistry, source: OutcomeSource): Promise<OutcomePolicy | undefined> {
  for (const policy of registry) if (await policy.supports({ source })) return policy;
  return undefined;
}
function sourceLabel(source: OutcomeSource): string {
  if (source.type === "action") return `Action "${source.action.id.value}"`;
  if (source.type === "workflow") return `Workflow "${source.workflow.id.value}"`;
  return `Automation "${source.automation.id.value}"`;
}
function date(value: Date, field: string): Date { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new TypeError(`${field} must be valid.`); return result; }
