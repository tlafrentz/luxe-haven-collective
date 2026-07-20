import { ActionCollection } from "../../actions";
import { ExecutionStatus, type ExecutionOptions, type Executor } from "../../execution";
import type { ObservationValue } from "../../observations";
import { WorkflowCollection, type WorkflowDefinitionId, type WorkflowId } from "../domain";
import { WorkflowBuilder } from "./workflow-builder";
import { WorkflowRegistry } from "./workflow-registry";
import { WorkflowSession } from "./workflow-session";

export type WorkflowExecutionOptions = ExecutionOptions & Readonly<{
  definitionIds?: readonly WorkflowDefinitionId[];
}>;
export type WorkflowExecutionInput = Readonly<{
  actions: ActionCollection;
  registry?: WorkflowRegistry;
  options?: WorkflowExecutionOptions;
  metadata?: Readonly<Record<string, ObservationValue>>;
  now?: () => Date;
  createWorkflowId?: (definitionId: WorkflowDefinitionId) => WorkflowId;
}>;

export class WorkflowExecutor implements Executor<WorkflowExecutionInput, WorkflowSession> {
  public constructor(private readonly registry?: WorkflowRegistry, private readonly builder = new WorkflowBuilder()) {}
  public async execute(input: WorkflowExecutionInput): Promise<WorkflowSession> {
    const registry = input.registry ?? this.registry;
    if (!registry) throw new TypeError("A Workflow registry is required.");
    const now = input.now ?? (() => new Date());
    const startedAt = validDate(now(), "Workflow execution start date");
    const requested = input.options?.definitionIds;
    const definitions = requested ?? registry.toArray().map((definition) => definition.id);
    let workflows = WorkflowCollection.empty();
    const warnings: string[] = [], errors: string[] = [], skippedItems: string[] = [], exceptions: string[] = [];
    for (const definitionId of definitions) {
      const definition = registry.get(definitionId);
      if (!definition) {
        errors.push(`Workflow definition not found: ${definitionId.value}.`);
        exceptions.push(definitionId.value);
        if (input.options?.continueOnFailure === false) break;
        continue;
      }
      try {
        workflows = workflows.add(this.builder.build({
          definition,
          actions: input.actions,
          createdAt: validDate(now(), "Workflow creation date"),
          ...(input.createWorkflowId ? { id: input.createWorkflowId(definition.id) } : {}),
          metadata: { definitionId: definition.id.value },
        }));
      } catch (error) {
        skippedItems.push(definition.id.value);
        warnings.push(error instanceof Error ? error.message : String(error));
        if (input.options?.continueOnFailure === false) break;
      }
    }
    const completedAt = validDate(now(), "Workflow execution completion date");
    const failed = exceptions.length;
    const processed = workflows.size + skippedItems.length + failed;
    const status = failed
      ? (workflows.isEmpty ? ExecutionStatus.FAILED : ExecutionStatus.COMPLETED_WITH_WARNINGS)
      : (warnings.length ? ExecutionStatus.COMPLETED_WITH_WARNINGS : ExecutionStatus.COMPLETED);
    return WorkflowSession.create({ workflows, status, statistics: { startedAt, completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), processed, succeeded: workflows.size, skipped: skippedItems.length, failed }, diagnostics: { warnings, errors, skippedItems, exceptions }, metadata: input.metadata });
  }
}
function validDate(value: Date, field: string): Date {
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw new TypeError(`${field} must be valid.`);
  return result;
}
