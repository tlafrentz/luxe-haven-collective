import type { DecisionCollection } from "../../decisions";
import { ExecutionStatus, type Executor } from "../../execution";
import type { ObservationValue } from "../../observations";
import { ActionCollection } from "../compatibility";
import type { ActionId } from "../domain";
import { ActionBuilder } from "./action-builder";
import type { ActionPolicy } from "./action-policy";
import { ActionPolicyRegistry } from "./action-policy-registry";
import { ActionSession } from "./action-session";

export type ActionExecutionInput = Readonly<{
  decisions: DecisionCollection;
  registry?: ActionPolicyRegistry;
  metadata?: Readonly<Record<string, ObservationValue>>;
  now?: () => Date;
  createActionId?: (policy: ActionPolicy) => ActionId;
}>;
export class ActionExecutor implements Executor<ActionExecutionInput, ActionSession> {
  public constructor(private readonly registry?: ActionPolicyRegistry, private readonly builder = new ActionBuilder()) {}
  public async execute(input: ActionExecutionInput): Promise<ActionSession> {
    const registry = input.registry ?? this.registry;
    if (!registry) throw new TypeError("An Action policy registry is required.");
    const now = input.now ?? (() => new Date());
    const startedAt = validDate(now(), "Action execution start date");
    let actions = ActionCollection.empty();
    const warnings: string[] = [], errors: string[] = [], skippedItems: string[] = [], exceptions: string[] = [];
    for (const policy of registry) {
      try {
        const context = { decisions: input.decisions };
        if (!(await policy.supports(context))) { skippedItems.push(policy.name); continue; }
        const result = await policy.create(context);
        if (!result) { skippedItems.push(policy.name); warnings.push(`Action policy "${policy.name}" produced no Action.`); continue; }
        actions = actions.add(this.builder.build({ result, createdAt: validDate(now(), "Action creation date"), ...(input.createActionId ? { id: input.createActionId(policy) } : {}), metadata: { policy: policy.name, ...(policy.version ? { policyVersion: policy.version } : {}) } }));
      } catch (error) {
        errors.push(`Action policy "${policy.name}" failed: ${error instanceof Error ? error.message : String(error)}`);
        exceptions.push(policy.name);
      }
    }
    const completedAt = validDate(now(), "Action execution completion date");
    const failed = exceptions.length;
    const status = failed ? (actions.isEmpty ? ExecutionStatus.FAILED : ExecutionStatus.COMPLETED_WITH_WARNINGS) : (warnings.length ? ExecutionStatus.COMPLETED_WITH_WARNINGS : ExecutionStatus.COMPLETED);
    return ActionSession.create({ actions, status, statistics: { startedAt, completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), processed: registry.size, succeeded: actions.size, skipped: skippedItems.length, failed }, diagnostics: { warnings, errors, skippedItems, exceptions }, metadata: input.metadata });
  }
}
function validDate(value: Date, field: string): Date { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new TypeError(`${field} must be valid.`); return result; }
