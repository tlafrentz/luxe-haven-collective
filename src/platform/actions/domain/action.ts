import type { Decision } from "../../decisions";
import { EntityWithProps, Identifier } from "../../kernel";
import type { ObservationValue } from "../../observations";
import { createActionId, type ActionId } from "./action-id";
import type { ActionOutcome } from "./action-outcome";
import type { ActionOwner, ActionOwnerType } from "./action-owner";
import { ACTION_PRIORITIES, type ActionPriority } from "./action-priority";
import { ACTION_STATUSES, type ActionStatus } from "./action-status";
import type { ActionType } from "./action-type";

type ActionProps = Readonly<{
  title: string;
  summary: string;
  type: ActionType;
  priority: ActionPriority;
  status: ActionStatus;
  owner: ActionOwner;
  decisionIdValues: readonly string[];
  createdAt: Date;
  acceptedAt?: Date;
  scheduledFor?: Date;
  startedAt?: Date;
  completedAt?: Date;
  measuredAt?: Date;
  archivedAt?: Date;
  outcome?: ActionOutcome;
  metadata: Readonly<Record<string, ObservationValue>>;
}>;

export type ActionInput = Readonly<{
  id?: ActionId;
  title: string;
  summary: string;
  type: ActionType;
  priority: ActionPriority;
  status?: ActionStatus;
  owner: ActionOwner;
  decisionIds: readonly Identifier[];
  createdAt: Date;
  acceptedAt?: Date;
  scheduledFor?: Date;
  startedAt?: Date;
  completedAt?: Date;
  measuredAt?: Date;
  archivedAt?: Date;
  outcome?: ActionOutcome;
  metadata?: Readonly<Record<string, ObservationValue>>;
}>;

export class Action extends EntityWithProps<ActionProps, ActionId> {
  private constructor(id: ActionId, props: ActionProps) { super(id, props); }

  public static create(input: ActionInput): Action {
    const status = input.status ?? "proposed";
    const decisionIdValues = [...new Set(input.decisionIds.map((id) => id.value))];
    if (!ACTION_STATUSES.includes(status)) throw new TypeError("Action status is invalid.");
    if (!ACTION_PRIORITIES.includes(input.priority)) throw new TypeError("Action priority is invalid.");
    const createdAt = date(input.createdAt, "Action creation date");
    const acceptedAt = optionalDate(input.acceptedAt, "Action acceptance date");
    const scheduledFor = optionalDate(input.scheduledFor, "Action schedule date");
    const startedAt = optionalDate(input.startedAt, "Action start date");
    const completedAt = optionalDate(input.completedAt, "Action completion date");
    const measuredAt = optionalDate(input.measuredAt, "Action measurement date");
    const archivedAt = optionalDate(input.archivedAt, "Action archive date");
    if (completedAt && !input.outcome) throw new TypeError("A completed Action requires an outcome.");

    return new Action(input.id ?? createActionId(), {
      title: text(input.title, "Action title"),
      summary: text(input.summary, "Action summary"),
      type: text(input.type, "Action type"),
      priority: input.priority,
      status,
      owner: normalizeOwner(input.owner),
      decisionIdValues: Object.freeze(decisionIdValues),
      createdAt,
      ...(acceptedAt ? { acceptedAt } : {}),
      ...(scheduledFor ? { scheduledFor } : {}),
      ...(startedAt ? { startedAt } : {}),
      ...(completedAt ? { completedAt } : {}),
      ...(measuredAt ? { measuredAt } : {}),
      ...(archivedAt ? { archivedAt } : {}),
      ...(input.outcome ? { outcome: normalizeOutcome(input.outcome) } : {}),
      metadata: Object.freeze({ ...input.metadata }),
    });
  }

  public get title(): string { return this.props.title; }
  public get summary(): string { return this.props.summary; }
  public get type(): ActionType { return this.props.type; }
  public get priority(): ActionPriority { return this.props.priority; }
  public get status(): ActionStatus { return this.props.status; }
  public get owner(): ActionOwner { return this.props.owner; }
  public get decisionIds(): readonly Identifier[] {
    return this.props.decisionIdValues.map((value) => Identifier.create(value));
  }
  public get createdAt(): Date { return new Date(this.props.createdAt); }
  public get acceptedAt(): Date | undefined { return copy(this.props.acceptedAt); }
  public get scheduledFor(): Date | undefined { return copy(this.props.scheduledFor); }
  public get startedAt(): Date | undefined { return copy(this.props.startedAt); }
  public get completedAt(): Date | undefined { return copy(this.props.completedAt); }
  public get measuredAt(): Date | undefined { return copy(this.props.measuredAt); }
  public get archivedAt(): Date | undefined { return copy(this.props.archivedAt); }
  public get outcome(): ActionOutcome | undefined { return this.props.outcome; }
  public get metadata(): Readonly<Record<string, ObservationValue>> { return this.props.metadata; }
  public originatesFrom(decision: Decision<string> | Identifier): boolean {
    const id = decision instanceof Identifier ? decision : decision.id;
    return this.props.decisionIdValues.includes(id.value);
  }

  public accept(acceptedAt: Date): Action {
    return this.transition(["proposed"], "accepted", { acceptedAt });
  }
  public schedule(scheduledFor: Date): Action {
    return this.transition(["accepted"], "scheduled", { scheduledFor });
  }
  public start(startedAt: Date): Action {
    return this.transition(["accepted"], "in-progress", { startedAt });
  }
  public block(): Action {
    return this.transition(["accepted", "scheduled", "in-progress"], "blocked");
  }
  public complete(completedAt: Date, outcome: ActionOutcome): Action {
    return this.transition(["accepted", "scheduled", "in-progress", "blocked"], "completed", {
      completedAt,
      outcome,
    });
  }
  public measure(
    measuredAt: Date,
    measurement: Pick<ActionOutcome, "measuredImpact" | "lessonsLearned">,
  ): Action {
    if (this.status !== "completed") this.invalidTransition("measured");
    if (!this.outcome) throw new Error("Cannot measure an action without a completion outcome.");
    const lessons = measurement.lessonsLearned?.map((value) => value.trim()).filter(Boolean) ?? [];
    const impact = measurement.measuredImpact;
    if (!impact && lessons.length === 0) {
      throw new Error("Action measurement must include measured impact or lessons learned.");
    }
    return this.transition(["completed"], "measured", {
      measuredAt,
      outcome: {
        ...this.outcome,
        ...(this.outcome.measuredImpact || impact
          ? { measuredImpact: { ...this.outcome.measuredImpact, ...impact } }
          : {}),
        lessonsLearned: [...(this.outcome.lessonsLearned ?? []), ...lessons],
      },
    });
  }
  public archive(archivedAt: Date): Action {
    return this.transition(["proposed", "accepted", "blocked", "completed", "measured"], "archived", {
      archivedAt,
    });
  }

  private transition(
    allowed: readonly ActionStatus[],
    status: ActionStatus,
    changes: Partial<ActionInput> = {},
  ): Action {
    if (!allowed.includes(this.status)) this.invalidTransition(status);
    return Action.create({ ...this.toInput(), ...changes, status });
  }
  private invalidTransition(status: ActionStatus): never {
    throw new Error(`Cannot transition action from "${this.status}" to "${status}".`);
  }
  private toInput(): ActionInput {
    return {
      id: this.id,
      title: this.title,
      summary: this.summary,
      type: this.type,
      priority: this.priority,
      status: this.status,
      owner: this.owner,
      decisionIds: this.decisionIds,
      createdAt: this.createdAt,
      ...(this.acceptedAt ? { acceptedAt: this.acceptedAt } : {}),
      ...(this.scheduledFor ? { scheduledFor: this.scheduledFor } : {}),
      ...(this.startedAt ? { startedAt: this.startedAt } : {}),
      ...(this.completedAt ? { completedAt: this.completedAt } : {}),
      ...(this.measuredAt ? { measuredAt: this.measuredAt } : {}),
      ...(this.archivedAt ? { archivedAt: this.archivedAt } : {}),
      ...(this.outcome ? { outcome: this.outcome } : {}),
      metadata: this.metadata,
    };
  }
}

function text(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${field} cannot be empty.`);
  return normalized;
}
function date(value: Date, field: string): Date {
  const result = new Date(value);
  if (Number.isNaN(result.getTime())) throw new TypeError(`${field} must be valid.`);
  return result;
}
function optionalDate(value: Date | undefined, field: string): Date | undefined {
  return value ? date(value, field) : undefined;
}
function copy(value: Date | undefined): Date | undefined { return value ? new Date(value) : undefined; }
function normalizeOwner(owner: ActionOwner): ActionOwner {
  const types: readonly ActionOwnerType[] = ["user", "team", "automation", "system"];
  if (!types.includes(owner.type)) throw new TypeError("Action owner type is invalid.");
  return Object.freeze({ type: owner.type, id: text(owner.id, "Action owner ID"), displayName: text(owner.displayName, "Action owner display name") });
}
function normalizeOutcome(outcome: ActionOutcome): ActionOutcome {
  return Object.freeze({
    summary: text(outcome.summary, "Action outcome summary"),
    successful: outcome.successful,
    ...(outcome.measuredImpact ? { measuredImpact: Object.freeze({ ...outcome.measuredImpact }) } : {}),
    ...(outcome.lessonsLearned ? { lessonsLearned: Object.freeze([...new Set(outcome.lessonsLearned.map((value) => value.trim()).filter(Boolean))]) } : {}),
    ...(outcome.metadata ? { metadata: Object.freeze({ ...outcome.metadata }) } : {}),
  });
}
