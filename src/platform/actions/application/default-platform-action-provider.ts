import type { ActionAssignmentId, ActionMutationContext, PlatformAction, PlatformActionCollection } from "../domain";
import { PlatformAction as PlatformActionAggregate } from "../domain";
import type { ArchiveActionCommand, AssignActionCommand, BlockActionCommand, CancelActionCommand, ChangeActionOwnerCommand, ChangeActionPriorityCommand, ClaimActionCommand, CommitActionCommand, CompleteActionCommand, CreateCommittedActionCommand, CreateDraftActionCommand, LinkActionOutcomeCommand, MarkActionReadyCommand, ReleaseActionAssignmentCommand, ScheduleActionCommand, StartActionCommand, UnblockActionCommand } from "./action-commands";
import type { PlatformActionProvider } from "./action-provider";
import type { FindActionByIdQuery, PlatformActionQuery } from "./action-queries";
import type { PlatformActionProviderDependencies } from "./platform-action-provider-dependencies";
import { PlatformActionNotFound, PlatformActionWorkspaceMismatch, StalePlatformActionVersion } from "./platform-action-provider-errors";

type ExistingActionCommand = CommitActionCommand | AssignActionCommand | ReleaseActionAssignmentCommand | ClaimActionCommand | ScheduleActionCommand | MarkActionReadyCommand | StartActionCommand | BlockActionCommand | UnblockActionCommand | CompleteActionCommand | CancelActionCommand | ArchiveActionCommand | LinkActionOutcomeCommand | ChangeActionPriorityCommand | ChangeActionOwnerCommand;

export class DefaultPlatformActionProvider implements PlatformActionProvider {
  public constructor(private readonly dependencies: PlatformActionProviderDependencies) {}

  public createDraft(command: CreateDraftActionCommand): Promise<PlatformAction> { return this.create(command, "draft"); }
  public createCommitted(command: CreateCommittedActionCommand): Promise<PlatformAction> { return this.create(command, "committed"); }
  public commit(command: CommitActionCommand): Promise<PlatformAction> { return this.mutate(command, (action, context) => action.commit(context)); }
  public assign(command: AssignActionCommand): Promise<PlatformAction> {
    return this.mutate(command, (action, context) => action.assign({ ...context, assignmentId: (command.assignmentId as ActionAssignmentId | undefined) ?? this.dependencies.createAssignmentId(), assigneeType: command.assigneeType, ...(command.assigneeId ? { assigneeId: command.assigneeId } : {}), ...(command.queue ? { queue: command.queue } : {}) }));
  }
  public releaseAssignment(command: ReleaseActionAssignmentCommand): Promise<PlatformAction> { return this.mutate(command, (action, context) => action.releaseAssignment(context)); }
  public claim(command: ClaimActionCommand): Promise<PlatformAction> { return this.mutate(command, (action, context) => action.claim({ ...context, assigneeType: command.assigneeType, ...(command.assigneeId ? { assigneeId: command.assigneeId } : {}) })); }
  public schedule(command: ScheduleActionCommand): Promise<PlatformAction> { return this.mutate(command, (action, context) => action.schedule({ ...context, ...(command.scheduled ? { scheduled: command.scheduled } : {}), ...(command.startAfter ? { startAfter: command.startAfter } : {}), ...(command.due ? { due: command.due } : {}) })); }
  public markReady(command: MarkActionReadyCommand): Promise<PlatformAction> { return this.mutate(command, (action, context) => action.markReady(context)); }
  public start(command: StartActionCommand): Promise<PlatformAction> { return this.mutate(command, (action, context) => action.start(context)); }
  public block(command: BlockActionCommand): Promise<PlatformAction> { return this.mutate(command, (action, context) => action.block(context)); }
  public unblock(command: UnblockActionCommand): Promise<PlatformAction> { return this.mutate(command, (action, context) => action.unblock({ ...context, resumeTo: command.resumeTo })); }
  public complete(command: CompleteActionCommand): Promise<PlatformAction> { return this.mutate(command, (action, context) => action.complete(context)); }
  public cancel(command: CancelActionCommand): Promise<PlatformAction> { return this.mutate(command, (action, context) => action.cancel(context)); }
  public archive(command: ArchiveActionCommand): Promise<PlatformAction> { return this.mutate(command, (action, context) => action.archive(context)); }
  public linkOutcome(command: LinkActionOutcomeCommand): Promise<PlatformAction> { return this.mutate(command, (action, context) => action.linkOutcome({ ...context, outcomeId: command.outcomeId, linkType: command.linkType })); }
  public changePriority(command: ChangeActionPriorityCommand): Promise<PlatformAction> { return this.mutate(command, (action, context) => action.changePriority({ ...context, priority: command.priority })); }
  public changeOwner(command: ChangeActionOwnerCommand): Promise<PlatformAction> { return this.mutate(command, (action, context) => action.changeOwner({ ...context, owner: command.owner })); }

  public findById(query: FindActionByIdQuery): Promise<PlatformAction | null> { this.assertWorkspace(query.workspaceId); return this.dependencies.repository.findById(query); }
  public find(query: PlatformActionQuery): Promise<PlatformActionCollection> { this.assertWorkspace(query.workspaceId); return this.dependencies.repository.find(query); }

  private async create(command: CreateDraftActionCommand, status: "draft" | "committed"): Promise<PlatformAction> {
    this.assertWorkspace(command.workspaceId);
    const occurredAt = this.date(command.occurredAt);
    const input = { id: command.actionId ?? this.dependencies.createActionId(), workspaceId: command.workspaceId, title: command.title, ...(command.description ? { description: command.description } : {}), ...(command.actionType ? { actionType: command.actionType } : {}), priority: command.priority, owner: command.owner, sources: command.sources, createdAt: occurredAt, createdBy: command.actor, ...(command.commandId ? { commandId: command.commandId } : {}) };
    const action = status === "draft" ? PlatformActionAggregate.createDraft(input) : PlatformActionAggregate.createCommitted(input);
    await this.dependencies.repository.add({ action });
    return action;
  }

  private async mutate(command: ExistingActionCommand, operation: (action: PlatformAction, context: ActionMutationContext) => PlatformAction): Promise<PlatformAction> {
    this.assertWorkspace(command.workspaceId);
    const action = await this.dependencies.repository.findById({ workspaceId: command.workspaceId, actionId: command.actionId });
    if (!action) throw new PlatformActionNotFound(command.actionId.value, command.workspaceId.value);
    if (!action.workspaceId.equals(command.workspaceId)) throw new PlatformActionWorkspaceMismatch(action.id.value, command.workspaceId.value, action.workspaceId.value);
    if (!action.version.equals(command.expectedVersion)) throw new StalePlatformActionVersion(action.id.value, command.expectedVersion.value, action.version.value);
    const context: ActionMutationContext = { workspaceId: command.workspaceId, expectedVersion: command.expectedVersion, actor: command.actor, occurredAt: this.date(command.occurredAt), ...(command.reason ? { reason: command.reason } : {}), ...(command.commandId ? { commandId: command.commandId } : {}), ...(command.externalEventId ? { externalEventId: command.externalEventId } : {}) };
    const updated = operation(action, context);
    await this.dependencies.repository.replace({ action: updated, expectedVersion: command.expectedVersion });
    return updated;
  }

  private assertWorkspace(workspaceId: { readonly value: string }): void { if (!workspaceId?.value?.trim()) throw new TypeError("Workspace ID is required."); }
  private date(value: Date | undefined): Date { const result = new Date(value ?? this.dependencies.now()); if (Number.isNaN(result.getTime())) throw new TypeError("Action command timestamp must be valid."); return result; }
}
