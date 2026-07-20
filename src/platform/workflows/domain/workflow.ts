import type { ObservationValue } from "../../observations";
import type { WorkflowDefinitionId } from "./workflow-definition-id";
import type { WorkflowId } from "./workflow-id";
import type { WorkflowStatus } from "./workflow-status";
import { WorkflowStep } from "./workflow-step";
import type { WorkflowStepId } from "./workflow-step-id";

export type WorkflowProgress = Readonly<{
  completedSteps: number;
  totalSteps: number;
  percentComplete: number;
}>;
export type WorkflowHistoryEntry = Readonly<{
  status: WorkflowStatus;
  recordedAt: Date;
  note?: string;
}>;
export type WorkflowInput = Readonly<{
  id: WorkflowId;
  definitionId: WorkflowDefinitionId;
  title: string;
  description: string;
  status: WorkflowStatus;
  steps: readonly WorkflowStep[];
  currentStepId?: WorkflowStepId;
  history: readonly WorkflowHistoryEntry[];
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

export class Workflow {
  public readonly id: WorkflowId;
  public readonly definitionId: WorkflowDefinitionId;
  public readonly title: string;
  public readonly description: string;
  public readonly status: WorkflowStatus;
  public readonly steps: readonly WorkflowStep[];
  public readonly currentStepId?: WorkflowStepId;
  public readonly history: readonly WorkflowHistoryEntry[];
  public readonly metadata: Readonly<Record<string, ObservationValue>>;

  private constructor(input: WorkflowInput) {
    const ordered = [...input.steps].sort((a, b) => a.order - b.order);
    if (new Set(ordered.map((step) => step.id.value)).size !== ordered.length) {
      throw new RangeError("Workflow step IDs must be unique.");
    }
    if (input.currentStepId && !ordered.some((step) => step.id.equals(input.currentStepId!))) {
      throw new RangeError(`Current workflow step not found: ${input.currentStepId.value}.`);
    }
    if (input.history.length === 0) throw new RangeError("Workflow history cannot be empty.");
    this.id = input.id;
    this.definitionId = input.definitionId;
    this.title = text(input.title, "Workflow title");
    this.description = text(input.description, "Workflow description");
    this.status = input.status;
    this.steps = Object.freeze(ordered);
    this.currentStepId = input.currentStepId;
    this.history = Object.freeze(input.history.map((entry) => Object.freeze({
      status: entry.status,
      recordedAt: validDate(entry.recordedAt, "Workflow history date"),
      ...(entry.note ? { note: text(entry.note, "Workflow history note") } : {}),
    })));
    this.metadata = Object.freeze({ ...input.metadata });
    Object.freeze(this);
  }
  public static create(input: WorkflowInput): Workflow { return new Workflow(input); }
  public get currentStep(): WorkflowStep | undefined {
    return this.currentStepId ? this.steps.find((step) => step.id.equals(this.currentStepId!)) : undefined;
  }
  public get progress(): WorkflowProgress {
    const completedSteps = this.steps.filter((step) => step.isComplete).length;
    const totalSteps = this.steps.length;
    return Object.freeze({
      completedSteps,
      totalSteps,
      percentComplete: totalSteps === 0 ? 100 : (completedSteps / totalSteps) * 100,
    });
  }
  public withStatus(status: WorkflowStatus, recordedAt: Date, note?: string): Workflow {
    return Workflow.create({
      id: this.id,
      definitionId: this.definitionId,
      title: this.title,
      description: this.description,
      status,
      steps: this.steps,
      ...(this.currentStepId ? { currentStepId: this.currentStepId } : {}),
      history: [...this.history, { status, recordedAt, ...(note ? { note } : {}) }],
      metadata: this.metadata,
    });
  }
}

function text(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${field} cannot be empty.`);
  return normalized;
}
function validDate(value: Date, field: string): Date {
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw new TypeError(`${field} must be valid.`);
  return result;
}
