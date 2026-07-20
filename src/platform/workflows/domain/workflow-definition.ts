import type { ObservationValue } from "../../observations";
import type { ActionType } from "../../actions";
import type { WorkflowCompletionCriterion } from "./workflow-step";
import type { WorkflowDefinitionId } from "./workflow-definition-id";
import type { WorkflowStepId } from "./workflow-step-id";

export type WorkflowStepDefinition = Readonly<{
  id: WorkflowStepId;
  title: string;
  description: string;
  order: number;
  requiredActionTypes: readonly ActionType[];
  completionCriterion?: WorkflowCompletionCriterion;
  dependencyIds?: readonly WorkflowStepId[];
}>;
export type WorkflowDefinitionInput = Readonly<{
  id: WorkflowDefinitionId;
  title: string;
  description: string;
  steps: readonly WorkflowStepDefinition[];
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

export class WorkflowDefinition {
  public readonly id: WorkflowDefinitionId;
  public readonly title: string;
  public readonly description: string;
  public readonly steps: readonly WorkflowStepDefinition[];
  public readonly metadata: Readonly<Record<string, ObservationValue>>;

  private constructor(input: WorkflowDefinitionInput) {
    this.id = input.id;
    this.title = text(input.title, "Workflow definition title");
    this.description = text(input.description, "Workflow definition description");
    validateSteps(input.steps);
    this.steps = Object.freeze([...input.steps]
      .sort((a, b) => a.order - b.order)
      .map((step) => Object.freeze({
        ...step,
        title: text(step.title, "Workflow step title"),
        description: text(step.description, "Workflow step description"),
        requiredActionTypes: Object.freeze([...step.requiredActionTypes]),
        dependencyIds: Object.freeze([...(step.dependencyIds ?? [])]),
      })));
    this.metadata = Object.freeze({ ...input.metadata });
    Object.freeze(this);
  }
  public static create(input: WorkflowDefinitionInput): WorkflowDefinition { return new WorkflowDefinition(input); }
}

function validateSteps(steps: readonly WorkflowStepDefinition[]): void {
  const ids = steps.map((step) => step.id.value);
  const orders = steps.map((step) => step.order);
  if (new Set(ids).size !== ids.length) throw new RangeError("Workflow definition step IDs must be unique.");
  if (new Set(orders).size !== orders.length) throw new RangeError("Workflow definition step orders must be unique.");
  if (orders.some((order) => !Number.isSafeInteger(order) || order < 0)) throw new RangeError("Workflow step order must be a non-negative integer.");
  const known = new Set(ids);
  for (const step of steps) {
    for (const dependency of step.dependencyIds ?? []) {
      if (!known.has(dependency.value)) throw new RangeError(`Workflow step dependency not found: ${dependency.value}.`);
      if (dependency.equals(step.id)) throw new RangeError(`Workflow step cannot depend on itself: ${step.id.value}.`);
    }
  }
  detectCycles(steps);
}
function detectCycles(steps: readonly WorkflowStepDefinition[]): void {
  const byId = new Map(steps.map((step) => [step.id.value, step]));
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id)) throw new RangeError("Workflow step dependencies cannot contain a cycle.");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dependency of byId.get(id)?.dependencyIds ?? []) visit(dependency.value);
    visiting.delete(id); visited.add(id);
  };
  for (const id of byId.keys()) visit(id);
}
function text(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${field} cannot be empty.`);
  return normalized;
}
