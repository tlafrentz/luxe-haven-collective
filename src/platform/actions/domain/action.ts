import { EntityWithProps } from "../../kernel";
import { createActionActor, type ActionActor } from "./action-actor";
import { createActionAssignment, createActionAssignmentId, isActiveAssignment, type PlatformActionAssignment } from "./action-assignment";
import { ActionAlreadyArchived, ActionAlreadyAssigned, DuplicateActionSource, DuplicateOutcomeReference, InvalidActionTransition, InvalidActionVersion, MissingActionSource, NoActiveAssignment, InvalidAssignmentClaim, WorkspaceScopeViolation } from "./action-errors";
import { createActionHistory, createActionHistoryId, type ActionHistoryOperation, type PlatformActionHistory } from "./action-history";
import { createActionId, type ActionId, type WorkspaceId } from "./action-id";
import { createActionOutcomeReference, type ActionOutcomeId, type ActionOutcomeLinkType, type PlatformActionOutcomeReference } from "./action-outcome-reference";
import { createActionOwner, type ActionOwner } from "./action-owner";
import { ACTION_PRIORITIES, type ActionPriority } from "./action-priority";
import { createActionSchedule, type PlatformActionSchedule } from "./action-schedule";
import { actionSourceKey, createActionSource, type PlatformActionSource } from "./action-source";
import { ACTION_STATUSES, ACTION_TRANSITIONS, type ActionStatus } from "./action-status";
import { ActionVersion } from "./action-version";

export type PlatformActionProps = Readonly<{
  id: ActionId;
  workspaceId: WorkspaceId;
  title: string;
  description?: string;
  actionType?: string;
  status: ActionStatus;
  priority: ActionPriority;
  owner: ActionOwner;
  assignments: readonly PlatformActionAssignment[];
  schedule: PlatformActionSchedule;
  sources: readonly PlatformActionSource[];
  history: readonly PlatformActionHistory[];
  outcomeReferences: readonly PlatformActionOutcomeReference[];
  createdAt: Date;
  createdBy: ActionActor;
  updatedAt: Date;
  version: ActionVersion;
}>;

export type CreatePlatformActionInput = Readonly<{
  id?: ActionId;
  workspaceId: WorkspaceId;
  title: string;
  description?: string;
  actionType?: string;
  priority: ActionPriority;
  owner: ActionOwner;
  sources: readonly PlatformActionSource[];
  createdAt: Date;
  createdBy: ActionActor;
  commandId?: string;
}>;

export type ActionMutationContext = Readonly<{ workspaceId: WorkspaceId; expectedVersion: ActionVersion; actor: ActionActor; occurredAt: Date; reason?: string; commandId?: string; externalEventId?: string }>;
export type AssignActionInput = ActionMutationContext & Readonly<{ assignmentId?: ReturnType<typeof createActionAssignmentId>; assigneeType: PlatformActionAssignment["assigneeType"]; assigneeId?: string; queue?: string }>;
export type ClaimActionInput = ActionMutationContext & Readonly<{ assigneeType: PlatformActionAssignment["assigneeType"]; assigneeId?: string }>;
export type ScheduleActionInput = ActionMutationContext & Readonly<{ scheduled?: Date; startAfter?: Date; due?: Date }>;
export type UnblockActionInput = ActionMutationContext & Readonly<{ resumeTo: "ready" | "in-progress" }>;
export type LinkOutcomeInput = ActionMutationContext & Readonly<{ outcomeId: ActionOutcomeId; linkType: ActionOutcomeLinkType }>;

type StoredActionProps = Omit<PlatformActionProps, "id">;

export class PlatformAction extends EntityWithProps<StoredActionProps, ActionId> {
  private constructor(input: PlatformActionProps) {
    super(input.id, normalizeState(input));
  }

  public static createDraft(input: CreatePlatformActionInput): PlatformAction { return PlatformAction.create(input, "draft"); }
  public static createCommitted(input: CreatePlatformActionInput): PlatformAction { return PlatformAction.create(input, "committed"); }
  public static reconstitute(input: PlatformActionProps): PlatformAction { return new PlatformAction(validateReconstituted(input)); }

  private static create(input: CreatePlatformActionInput, status: "draft" | "committed"): PlatformAction {
    const id = input.id ?? createActionId();
    const createdAt = validDate(input.createdAt, "Action creation date");
    const version = ActionVersion.initial();
    const actor = createActionActor(input.createdBy);
    return new PlatformAction({
      id,
      workspaceId: input.workspaceId,
      title: input.title,
      ...(input.description ? { description: input.description } : {}),
      ...(input.actionType ? { actionType: input.actionType } : {}),
      status,
      priority: input.priority,
      owner: input.owner,
      assignments: [],
      schedule: { created: createdAt },
      sources: input.sources,
      history: [createActionHistory({ id: createActionHistoryId(), actionId: id, version, operation: "created", resultingStatus: status, occurredAt: createdAt, actor, ...(input.commandId ? { commandId: input.commandId } : {}) })],
      outcomeReferences: [],
      createdAt,
      createdBy: actor,
      updatedAt: createdAt,
      version,
    });
  }

  public get workspaceId(): WorkspaceId { return this.props.workspaceId; }
  public get title(): string { return this.props.title; }
  public get description(): string | undefined { return this.props.description; }
  public get actionType(): string | undefined { return this.props.actionType; }
  public get status(): ActionStatus { return this.props.status; }
  public get priority(): ActionPriority { return this.props.priority; }
  public get owner(): ActionOwner { return this.props.owner; }
  public get assignments(): readonly PlatformActionAssignment[] { return this.props.assignments; }
  public get activeAssignment(): PlatformActionAssignment | undefined { return this.props.assignments.find(isActiveAssignment); }
  public get scheduleValue(): PlatformActionSchedule { return this.props.schedule; }
  public get sources(): readonly PlatformActionSource[] { return this.props.sources; }
  public get history(): readonly PlatformActionHistory[] { return this.props.history; }
  public get outcomeReferences(): readonly PlatformActionOutcomeReference[] { return this.props.outcomeReferences; }
  public get createdAt(): Date { return new Date(this.props.createdAt); }
  public get createdBy(): ActionActor { return this.props.createdBy; }
  public get updatedAt(): Date { return new Date(this.props.updatedAt); }
  public get version(): ActionVersion { return this.props.version; }

  public commit(command: ActionMutationContext): PlatformAction { return this.transition("committed", "committed", command); }
  public markReady(command: ActionMutationContext): PlatformAction { return this.transition("ready", "marked-ready", command); }
  public start(command: ActionMutationContext): PlatformAction { return this.transition("in-progress", "started", command); }
  public block(command: ActionMutationContext): PlatformAction { return this.transition("blocked", "blocked", command); }
  public unblock(command: UnblockActionInput): PlatformAction { return this.transition(command.resumeTo, "unblocked", command); }
  public cancel(command: ActionMutationContext): PlatformAction { return this.transition("cancelled", "cancelled", command); }
  public archive(command: ActionMutationContext): PlatformAction {
    if (this.status === "archived") throw new ActionAlreadyArchived();
    return this.transition("archived", "archived", command);
  }
  public complete(command: ActionMutationContext): PlatformAction {
    this.assertContext(command);
    this.assertTransition("completed");
    const at = validDate(command.occurredAt, "Action completion date");
    return this.change("completed", command, { status: "completed", schedule: createActionSchedule({ ...this.scheduleValue, completed: at }) });
  }
  public changePriority(command: ActionMutationContext & Readonly<{ priority: ActionPriority }>): PlatformAction {
    if (!ACTION_PRIORITIES.includes(command.priority)) throw new TypeError("Action priority is invalid.");
    return this.change("priority-changed", command, { priority: command.priority });
  }
  public changeOwner(command: ActionMutationContext & Readonly<{ owner: ActionOwner }>): PlatformAction {
    return this.change("owner-changed", command, { owner: createActionOwner(command.owner) });
  }
  public schedule(command: ScheduleActionInput): PlatformAction {
    return this.change("scheduled", command, { schedule: createActionSchedule({ created: this.scheduleValue.created, scheduled: command.scheduled ?? command.occurredAt, ...(command.startAfter ? { startAfter: command.startAfter } : {}), ...(command.due ? { due: command.due } : {}), ...(this.scheduleValue.completed ? { completed: this.scheduleValue.completed } : {}) }) });
  }
  public assign(command: AssignActionInput): PlatformAction {
    this.assertContext(command);
    if (this.activeAssignment) throw new ActionAlreadyAssigned();
    const queued = Boolean(command.queue);
    const assignment = createActionAssignment({ id: command.assignmentId ?? createActionAssignmentId(), assigneeType: command.assigneeType, ...(command.assigneeId ? { assigneeId: command.assigneeId } : {}), ...(command.queue ? { queue: command.queue } : {}), status: queued ? "queued" : "assigned", assignedAt: command.occurredAt, assignedBy: command.actor });
    return this.change("assigned", command, { assignments: [...this.assignments, assignment] });
  }
  public releaseAssignment(command: ActionMutationContext): PlatformAction {
    this.assertContext(command);
    const active = this.activeAssignment; if (!active) throw new NoActiveAssignment();
    const assignments = this.assignments.map((value) => value.id.equals(active.id) ? createActionAssignment({ ...value, status: "released", releasedAt: command.occurredAt }) : value);
    return this.change("assignment-released", command, { assignments });
  }
  public claim(command: ClaimActionInput): PlatformAction {
    this.assertContext(command);
    const active = this.activeAssignment; if (!active) throw new NoActiveAssignment();
    if (active.status !== "queued" && active.status !== "assigned") throw new InvalidAssignmentClaim();
    const assignee = createActionActor({ type: command.assigneeType, ...(command.assigneeId ? { id: command.assigneeId } : {}) });
    const assignments = this.assignments.map((value) => value.id.equals(active.id) ? createActionAssignment({ ...value, assigneeType: assignee.type, ...(assignee.id ? { assigneeId: assignee.id } : {}), status: "claimed", claimedAt: command.occurredAt }) : value);
    return this.change("claimed", command, { assignments });
  }
  public linkOutcome(command: LinkOutcomeInput): PlatformAction {
    this.assertContext(command);
    if (this.outcomeReferences.some((value) => value.outcomeId.equals(command.outcomeId))) throw new DuplicateOutcomeReference(command.outcomeId.value);
    const reference = createActionOutcomeReference({ outcomeId: command.outcomeId, linkType: command.linkType, linkedAt: command.occurredAt, linkedBy: command.actor });
    return this.change("outcome-linked", command, { outcomeReferences: [...this.outcomeReferences, reference] });
  }

  private transition(status: ActionStatus, operation: ActionHistoryOperation, command: ActionMutationContext): PlatformAction {
    this.assertContext(command); this.assertTransition(status); return this.change(operation, command, { status });
  }
  private assertTransition(status: ActionStatus): void { if (!ACTION_TRANSITIONS[this.status].includes(status)) throw new InvalidActionTransition(this.status, status); }
  private assertContext(command: ActionMutationContext): void {
    if (!this.workspaceId.equals(command.workspaceId)) throw new WorkspaceScopeViolation();
    if (!this.version.equals(command.expectedVersion)) throw new InvalidActionVersion(command.expectedVersion.value);
    if (this.status === "archived") throw new ActionAlreadyArchived();
    validDate(command.occurredAt, "Action operation date"); createActionActor(command.actor);
  }
  private change(operation: ActionHistoryOperation, command: ActionMutationContext, changes: Partial<StoredActionProps>): PlatformAction {
    this.assertContext(command);
    const version = this.version.next(), occurredAt = validDate(command.occurredAt, "Action operation date"), resultingStatus = changes.status ?? this.status;
    const history = createActionHistory({ id: createActionHistoryId(), actionId: this.id, version, operation, previousStatus: this.status, resultingStatus, occurredAt, actor: command.actor, ...(command.reason ? { reason: command.reason } : {}), ...(command.commandId ? { commandId: command.commandId } : {}), ...(command.externalEventId ? { externalEventId: command.externalEventId } : {}) });
    return new PlatformAction({ ...this.snapshot(), ...changes, id: this.id, updatedAt: occurredAt, version, history: [...this.history, history] });
  }
  private snapshot(): PlatformActionProps { return { id: this.id, workspaceId: this.workspaceId, title: this.title, ...(this.description ? { description: this.description } : {}), ...(this.actionType ? { actionType: this.actionType } : {}), status: this.status, priority: this.priority, owner: this.owner, assignments: this.assignments, schedule: this.scheduleValue, sources: this.sources, history: this.history, outcomeReferences: this.outcomeReferences, createdAt: this.createdAt, createdBy: this.createdBy, updatedAt: this.updatedAt, version: this.version }; }
}

function normalizeState(input: PlatformActionProps): StoredActionProps {
  if (!ACTION_STATUSES.includes(input.status)) throw new TypeError("Action status is invalid.");
  if (!ACTION_PRIORITIES.includes(input.priority)) throw new TypeError("Action priority is invalid.");
  const title = text(input.title, "Action title"), description = optionalText(input.description), actionType = optionalText(input.actionType);
  const sources = input.sources.map(createActionSource); if (sources.length === 0) throw new MissingActionSource();
  const keys = sources.map(actionSourceKey); if (new Set(keys).size !== keys.length) throw new DuplicateActionSource(keys.find((key, index) => keys.indexOf(key) !== index) ?? "unknown");
  const assignments = input.assignments.map(createActionAssignment); if (assignments.filter(isActiveAssignment).length > 1) throw new ActionAlreadyAssigned();
  const outcomes = input.outcomeReferences.map(createActionOutcomeReference), outcomeIds = outcomes.map((value) => value.outcomeId.value); if (new Set(outcomeIds).size !== outcomeIds.length) throw new DuplicateOutcomeReference(outcomeIds.find((id, index) => outcomeIds.indexOf(id) !== index) ?? "unknown");
  return { workspaceId: input.workspaceId, title, ...(description ? { description } : {}), ...(actionType ? { actionType } : {}), status: input.status, priority: input.priority, owner: createActionOwner(input.owner), assignments, schedule: createActionSchedule(input.schedule), sources, history: input.history.map(createActionHistory), outcomeReferences: outcomes, createdAt: validDate(input.createdAt, "Action creation date"), createdBy: createActionActor(input.createdBy), updatedAt: validDate(input.updatedAt, "Action update date"), version: ActionVersion.create(input.version.value) };
}
function validateReconstituted(input: PlatformActionProps): PlatformActionProps {
  if (input.history.length === 0) throw new TypeError("Reconstituted Actions require history.");
  if (!input.history.at(-1)?.version.equals(input.version)) throw new InvalidActionVersion(input.version.value);
  if (input.history.some((entry, index) => entry.version.value !== index + 1)) throw new InvalidActionVersion(input.version.value);
  if (input.history.some((entry) => !entry.actionId.equals(input.id))) throw new TypeError("Action history must reference its aggregate.");
  if (input.updatedAt < input.createdAt) throw new TypeError("Action update date cannot precede creation.");
  return input;
}
function text(value: string, field: string): string { const result = value.trim(); if (!result) throw new TypeError(`${field} cannot be empty.`); return result; }
function optionalText(value?: string): string | undefined { const result = value?.trim(); return result || undefined; }
function validDate(value: Date, field: string): Date { const result = new Date(value); if (Number.isNaN(result.getTime())) throw new TypeError(`${field} must be valid.`); return result; }
