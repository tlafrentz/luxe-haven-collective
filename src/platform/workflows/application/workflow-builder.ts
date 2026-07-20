import { ActionCollection, type ActionStatus } from "../../actions";
import type { ObservationValue } from "../../observations";
import {
  createWorkflowId,
  Workflow,
  type WorkflowDefinition,
  type WorkflowId,
  type WorkflowStatus,
  WorkflowStep,
} from "../domain";

export type WorkflowBuilderInput = Readonly<{
  definition: WorkflowDefinition;
  actions: ActionCollection;
  createdAt: Date;
  id?: WorkflowId;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

export class WorkflowBuilder {
  public build(input: WorkflowBuilderInput): Workflow {
    const steps = input.definition.steps.map((definition) => {
      const actions = input.actions.filter((action) => definition.requiredActionTypes.includes(action.type));
      const availableTypes = new Set(actions.toArray().map((action) => action.type));
      const missing = [...new Set(definition.requiredActionTypes)].filter((type) => !availableTypes.has(type));
      if (missing.length) {
        throw new WorkflowBuildError(input.definition.id.value, missing);
      }
      return WorkflowStep.create({
        ...definition,
        actions,
        completionCriterion: definition.completionCriterion ?? "all-actions-completed",
      });
    });
    const currentStep = steps.find((step) => !step.isComplete &&
      step.dependencyIds.every((id) => steps.find((candidate) => candidate.id.equals(id))?.isComplete));
    const status = deriveStatus(steps, currentStep);
    const createdAt = validDate(input.createdAt);
    return Workflow.create({
      id: input.id ?? createWorkflowId(),
      definitionId: input.definition.id,
      title: input.definition.title,
      description: input.definition.description,
      status,
      steps,
      ...(currentStep ? { currentStepId: currentStep.id } : {}),
      history: [{ status, recordedAt: createdAt, note: "Workflow created." }],
      metadata: { ...input.definition.metadata, ...input.metadata },
    });
  }
}

export class WorkflowBuildError extends Error {
  public readonly definitionId: string;
  public readonly missingActionTypes: readonly string[];
  public constructor(definitionId: string, missingActionTypes: readonly string[]) {
    super(`Cannot build workflow "${definitionId}". Missing Action types: ${missingActionTypes.join(", ")}.`);
    this.name = "WorkflowBuildError";
    this.definitionId = definitionId;
    this.missingActionTypes = Object.freeze([...missingActionTypes]);
  }
}

function deriveStatus(steps: readonly WorkflowStep[], current?: WorkflowStep): WorkflowStatus {
  if (steps.length === 0 || steps.every((step) => step.isComplete)) return "completed";
  if (!current) return "waiting";
  const statuses = current.actions.toArray().map((action) => action.status);
  if (statuses.includes("blocked")) return "blocked";
  if (statuses.some(active)) return "active";
  return "ready";
}
function active(status: ActionStatus): boolean { return status === "in-progress"; }
function validDate(value: Date): Date {
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw new TypeError("Workflow creation date must be valid.");
  return result;
}
