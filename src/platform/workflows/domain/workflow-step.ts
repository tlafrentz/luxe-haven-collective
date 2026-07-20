import { ActionCollection, type ActionType } from "../../actions";
import type { WorkflowStepId } from "./workflow-step-id";

export type WorkflowCompletionCriterion = "all-actions-completed" | "all-actions-measured";

export type WorkflowStepInput = Readonly<{
  id: WorkflowStepId;
  title: string;
  description: string;
  order: number;
  actions: ActionCollection;
  requiredActionTypes: readonly ActionType[];
  completionCriterion: WorkflowCompletionCriterion;
  dependencyIds?: readonly WorkflowStepId[];
}>;

export class WorkflowStep {
  public readonly id: WorkflowStepId;
  public readonly title: string;
  public readonly description: string;
  public readonly order: number;
  public readonly actions: ActionCollection;
  public readonly requiredActionTypes: readonly ActionType[];
  public readonly completionCriterion: WorkflowCompletionCriterion;
  public readonly dependencyIds: readonly WorkflowStepId[];

  private constructor(input: WorkflowStepInput) {
    if (!Number.isSafeInteger(input.order) || input.order < 0) {
      throw new RangeError("Workflow step order must be a non-negative integer.");
    }
    this.id = input.id;
    this.title = text(input.title, "Workflow step title");
    this.description = text(input.description, "Workflow step description");
    this.order = input.order;
    this.actions = input.actions;
    this.requiredActionTypes = Object.freeze(input.requiredActionTypes.map((type) => text(type, "Required Action type")));
    this.completionCriterion = input.completionCriterion;
    this.dependencyIds = Object.freeze([...(input.dependencyIds ?? [])]);
    Object.freeze(this);
  }

  public static create(input: WorkflowStepInput): WorkflowStep { return new WorkflowStep(input); }
  public get isComplete(): boolean {
    if (this.actions.isEmpty) return this.requiredActionTypes.length === 0;
    return this.actions.toArray().every((action) => this.completionCriterion === "all-actions-measured"
      ? action.status === "measured" || (action.status === "archived" && action.measuredAt !== undefined)
      : action.status === "completed" || action.status === "measured" ||
        (action.status === "archived" && action.completedAt !== undefined));
  }
  public dependsOn(id: WorkflowStepId): boolean {
    return this.dependencyIds.some((dependency) => dependency.equals(id));
  }
}

function text(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${field} cannot be empty.`);
  return normalized;
}
