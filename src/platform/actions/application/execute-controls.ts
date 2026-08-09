import {
  ActionVersion,
  createWorkspaceId,
  type ActionActor,
  type ActionBlocker,
  type ActionDependency,
  type ActionEvidence,
  type ActionEvidencePolicy,
  type PlatformAction,
  assertDependencyCanBeAdded,
  reviewEvidence,
  unresolvedDependencies,
  validateEvidencePolicy,
} from "../domain";
import type {
  ExecuteActivityEvent,
  ExecuteCommandResult,
  ExecuteNotificationIntent,
} from "./execute-application";

export type ExecuteControlState = Readonly<{
  action: PlatformAction;
  evidencePolicy: ActionEvidencePolicy;
  evidence: readonly ActionEvidence[];
  blockers: readonly ActionBlocker[];
  dependencies: readonly ActionDependency[];
  relatedActions: readonly PlatformAction[];
  completionCriteria?: readonly string[];
  propertyId?: string;
  planId?: string;
  expectedOutcome?: string;
  successMetric?: string;
}>;
export type ExecuteControlMutation = Readonly<{
  action?: PlatformAction;
  evidenceUpserts?: readonly ActionEvidence[];
  blockerUpserts?: readonly ActionBlocker[];
  dependencyUpserts?: readonly ActionDependency[];
  dependencyDeletes?: readonly Readonly<{
    actionId: string;
    dependsOnActionId: string;
  }>[];
  activity: readonly ExecuteActivityEvent[];
  notifications: readonly ExecuteNotificationIntent[];
}>;
export interface ExecuteControlRepository {
  get(
    workspaceId: string,
    actionId: string,
  ): Promise<ExecuteControlState | null>;
  commit(
    workspaceId: string,
    actionId: string,
    expectedVersion: number,
    mutation: ExecuteControlMutation,
  ): Promise<ExecuteControlState>;
}
export interface ExecuteControlAuthorization {
  canWork(
    input: Readonly<{
      workspaceId: string;
      action: PlatformAction;
      actor: ActionActor;
    }>,
  ): Promise<boolean>;
  canReview(
    input: Readonly<{
      workspaceId: string;
      action: PlatformAction;
      actor: ActionActor;
    }>,
  ): Promise<boolean>;
  canManage(
    input: Readonly<{
      workspaceId: string;
      action: PlatformAction;
      actor: ActionActor;
    }>,
  ): Promise<boolean>;
  canAccessDependency(
    input: Readonly<{
      workspaceId: string;
      actionId: string;
      actor: ActionActor;
    }>,
  ): Promise<boolean>;
}
export type ExecuteControlFailureCode =
  | "ACTION_NOT_FOUND"
  | "ACTION_VERSION_CONFLICT"
  | "ACTION_CONTROL_UNAUTHORIZED"
  | "ACTION_TRANSITION_INVALID"
  | "EVIDENCE_REQUIREMENT_UNMET"
  | "EVIDENCE_REVIEW_REQUIRED"
  | "DEPENDENCY_CYCLE_DETECTED"
  | "ACTION_DEPENDENCY_UNRESOLVED"
  | "BLOCKER_UNRESOLVED"
  | "CONTROL_PERSISTENCE_FAILURE";
export type ExecuteControlResult<T> =
  | ExecuteCommandResult<T>
  | Readonly<{
      ok: false;
      code: ExecuteControlFailureCode;
      message: string;
      retryable: boolean;
      currentVersion?: number;
      submittedInput?: unknown;
    }>;
export type ControlContext = Readonly<{
  workspaceId: string;
  actionId: string;
  expectedVersion: number;
  actor: ActionActor;
  occurredAt: Date;
  correlationId: string;
}>;

export class ExecuteControlsService {
  public constructor(
    private readonly d: Readonly<{
      repository: ExecuteControlRepository;
      authorization: ExecuteControlAuthorization;
      createId: () => string;
    }>,
  ) {}
  public attachEvidence(
    command: ControlContext &
      Readonly<{
        evidence: Omit<
          ActionEvidence,
          | "id"
          | "workspaceId"
          | "actionId"
          | "createdBy"
          | "createdAt"
          | "status"
        >;
      }>,
  ): Promise<ExecuteControlResult<ExecuteControlState>> {
    return this.change(
      command,
      "evidence-added",
      async (state) => {
        await this.work(command, state);
        const item: ActionEvidence = Object.freeze({
          ...command.evidence,
          id: this.d.createId(),
          workspaceId: command.workspaceId,
          actionId: command.actionId,
          createdBy: command.actor.id ?? "unknown",
          createdAt: command.occurredAt,
          status: "pending",
        });
        return {
          evidenceUpserts: [item],
          metadata: { evidenceType: item.type },
        };
      },
      command.evidence,
    );
  }
  public submitEvidence(
    command: ControlContext & Readonly<{ evidenceIds: readonly string[] }>,
  ): Promise<ExecuteControlResult<ExecuteControlState>> {
    return this.change(
      command,
      "evidence-submitted",
      async (state) => {
        await this.work(command, state);
        const selected = state.evidence.filter((item) =>
          command.evidenceIds.includes(item.id),
        );
        if (selected.length !== new Set(command.evidenceIds).size)
          throw problem(
            "EVIDENCE_REQUIREMENT_UNMET",
            "One or more evidence items are unavailable.",
          );
        const evidenceUpserts = selected.map((item) =>
          Object.freeze({
            ...item,
            status: "submitted" as const,
            submittedAt: command.occurredAt,
          }),
        );
        const policy = validateEvidencePolicy(
          state.evidencePolicy,
          state.evidence.map(
            (item) =>
              evidenceUpserts.find((next) => next.id === item.id) ?? item,
          ),
        );
        if (!policy.satisfied)
          throw problem("EVIDENCE_REQUIREMENT_UNMET", policy.issues.join(" "));
        return { evidenceUpserts, metadata: { count: evidenceUpserts.length } };
      },
      command.evidenceIds,
    );
  }
  public reviewEvidence(
    command: ControlContext &
      Readonly<{ evidenceId: string; accepted: boolean; reason?: string }>,
  ): Promise<ExecuteControlResult<ExecuteControlState>> {
    return this.change(
      command,
      command.accepted ? "evidence-accepted" : "evidence-rejected",
      async (state) => {
        await this.review(command, state);
        const item = state.evidence.find(
          (value) => value.id === command.evidenceId,
        );
        if (!item)
          throw problem(
            "EVIDENCE_REQUIREMENT_UNMET",
            "Evidence was not found.",
          );
        return {
          evidenceUpserts: [
            reviewEvidence(item, {
              accepted: command.accepted,
              ...(command.reason ? { reason: command.reason } : {}),
              actor: command.actor,
              occurredAt: command.occurredAt,
            }),
          ],
          metadata: { evidenceId: item.id },
        };
      },
      command,
    );
  }
  public addBlocker(
    command: ControlContext &
      Readonly<{
        blocker: Readonly<{
          category: ActionBlocker["category"];
          description: string;
          severity: ActionBlocker["severity"];
          blockingParty?: string;
          expectedResolutionAt?: Date;
        }>;
      }>,
  ): Promise<ExecuteControlResult<ExecuteControlState>> {
    return this.change(
      command,
      "blocker-added",
      async (state) => {
        await this.work(command, state);
        if (!command.blocker.description.trim())
          throw problem(
            "ACTION_TRANSITION_INVALID",
            "A blocker explanation is required.",
          );
        const blocker: ActionBlocker = Object.freeze({
          ...command.blocker,
          id: this.d.createId(),
          workspaceId: command.workspaceId,
          actionId: command.actionId,
          description: command.blocker.description.trim(),
          identifiedAt: command.occurredAt,
        });
        const action =
          state.action.status === "blocked"
            ? undefined
            : state.action.block(this.context(command));
        return {
          action,
          blockerUpserts: [blocker],
          metadata: { blockerId: blocker.id, severity: blocker.severity },
        };
      },
      command.blocker,
    );
  }
  public resolveBlocker(
    command: ControlContext &
      Readonly<{ blockerId: string; resolutionNote: string }>,
  ): Promise<ExecuteControlResult<ExecuteControlState>> {
    return this.change(
      command,
      "blocker-resolved",
      async (state) => {
        await this.work(command, state);
        const blocker = state.blockers.find(
          (item) => item.id === command.blockerId && !item.resolvedAt,
        );
        if (!blocker)
          throw problem(
            "BLOCKER_UNRESOLVED",
            "The active blocker was not found.",
          );
        if (!command.resolutionNote.trim())
          throw problem(
            "ACTION_TRANSITION_INVALID",
            "Resolving a blocker requires a note.",
          );
        return {
          blockerUpserts: [
            Object.freeze({
              ...blocker,
              resolutionNote: command.resolutionNote.trim(),
              resolvedById: command.actor.id ?? "unknown",
              resolvedAt: command.occurredAt,
            }),
          ],
          metadata: { blockerId: blocker.id },
        };
      },
      command,
    );
  }
  public updateBlocker(
    command: ControlContext &
      Readonly<{
        blockerId: string;
        changes: Readonly<{
          category?: ActionBlocker["category"];
          description?: string;
          severity?: ActionBlocker["severity"];
          blockingParty?: string;
          expectedResolutionAt?: Date;
        }>;
      }>,
  ): Promise<ExecuteControlResult<ExecuteControlState>> {
    return this.change(
      command,
      "blocker-updated",
      async (state) => {
        await this.work(command, state);
        const blocker = state.blockers.find(
          (item) => item.id === command.blockerId && !item.resolvedAt,
        );
        if (!blocker)
          throw problem(
            "BLOCKER_UNRESOLVED",
            "The active blocker was not found.",
          );
        const description = command.changes.description?.trim();
        if (command.changes.description !== undefined && !description)
          throw problem(
            "ACTION_TRANSITION_INVALID",
            "A blocker explanation is required.",
          );
        return {
          blockerUpserts: [
            Object.freeze({
              ...blocker,
              ...command.changes,
              ...(description ? { description } : {}),
            }),
          ],
          metadata: { blockerId: blocker.id },
        };
      },
      command.changes,
    );
  }
  public resume(
    command: ControlContext,
  ): Promise<ExecuteControlResult<ExecuteControlState>> {
    return this.change(command, "action-resumed", async (state) => {
      await this.work(command, state);
      if (state.blockers.some((item) => !item.resolvedAt))
        throw problem(
          "BLOCKER_UNRESOLVED",
          "Resolve every blocker before resuming work.",
        );
      return {
        action: state.action.unblock({
          ...this.context(command),
          resumeTo: "in-progress",
        }),
        metadata: {},
      };
    });
  }
  public addDependency(
    command: ControlContext & Readonly<{ dependsOnActionId: string }>,
  ): Promise<ExecuteControlResult<ExecuteControlState>> {
    return this.change(
      command,
      "dependency-added",
      async (state) => {
        await this.manage(command, state);
        if (
          !(await this.d.authorization.canAccessDependency({
            workspaceId: command.workspaceId,
            actionId: command.dependsOnActionId,
            actor: command.actor,
          }))
        )
          throw problem(
            "ACTION_CONTROL_UNAUTHORIZED",
            "The dependency is outside your authorized scope.",
          );
        try {
          assertDependencyCanBeAdded(
            command.actionId,
            command.dependsOnActionId,
            state.dependencies,
          );
        } catch (error) {
          throw problem(
            "DEPENDENCY_CYCLE_DETECTED",
            error instanceof Error
              ? error.message
              : "The dependency is invalid.",
          );
        }
        return {
          dependencyUpserts: [
            Object.freeze({
              workspaceId: command.workspaceId,
              actionId: command.actionId,
              dependsOnActionId: command.dependsOnActionId,
              createdById: command.actor.id ?? "unknown",
              createdAt: command.occurredAt,
            }),
          ],
          metadata: { dependsOnActionId: command.dependsOnActionId },
        };
      },
      command,
    );
  }
  public removeDependency(
    command: ControlContext & Readonly<{ dependsOnActionId: string }>,
  ): Promise<ExecuteControlResult<ExecuteControlState>> {
    return this.change(
      command,
      "dependency-removed",
      async (state) => {
        await this.manage(command, state);
        if (
          !state.dependencies.some(
            (item) =>
              item.actionId === command.actionId &&
              item.dependsOnActionId === command.dependsOnActionId,
          )
        )
          throw problem(
            "ACTION_DEPENDENCY_UNRESOLVED",
            "Dependency was not found.",
          );
        return {
          dependencyDeletes: [
            {
              actionId: command.actionId,
              dependsOnActionId: command.dependsOnActionId,
            },
          ],
          metadata: { dependsOnActionId: command.dependsOnActionId },
        };
      },
      command,
    );
  }
  public overrideDependency(
    command: ControlContext &
      Readonly<{ dependsOnActionId: string; reason: string }>,
  ): Promise<ExecuteControlResult<ExecuteControlState>> {
    return this.change(
      command,
      "dependency-overridden",
      async (state) => {
        await this.manage(command, state);
        if (!command.reason.trim())
          throw problem(
            "ACTION_TRANSITION_INVALID",
            "A dependency override requires a reason.",
          );
        const item = state.dependencies.find(
          (value) =>
            value.actionId === command.actionId &&
            value.dependsOnActionId === command.dependsOnActionId &&
            !value.overriddenAt,
        );
        if (!item)
          throw problem(
            "ACTION_DEPENDENCY_UNRESOLVED",
            "Active dependency was not found.",
          );
        return {
          dependencyUpserts: [
            Object.freeze({
              ...item,
              overrideReason: command.reason.trim(),
              overriddenById: command.actor.id ?? "unknown",
              overriddenAt: command.occurredAt,
            }),
          ],
          metadata: {
            dependsOnActionId: item.dependsOnActionId,
            reason: command.reason.trim(),
          },
        };
      },
      command,
    );
  }
  public transition(
    command: ControlContext &
      Readonly<{
        operation:
          | "start"
          | "submit-for-review"
          | "return-for-correction"
          | "complete"
          | "fail"
          | "retry"
          | "reopen";
        reason?: string;
      }>,
  ): Promise<ExecuteControlResult<ExecuteControlState>> {
    return this.change(
      command,
      `action-${command.operation}`,
      async (state) => {
        if (
          command.operation === "return-for-correction" ||
          command.operation === "complete"
        )
          await this.review(command, state);
        else await this.work(command, state);
        if (["submit-for-review", "complete"].includes(command.operation)) {
          const gate = validateEvidencePolicy(
            state.evidencePolicy,
            state.evidence,
            command.operation === "complete",
          );
          if (!gate.satisfied)
            throw problem(
              gate.reviewRequired
                ? "EVIDENCE_REVIEW_REQUIRED"
                : "EVIDENCE_REQUIREMENT_UNMET",
              gate.issues.join(" "),
            );
        }
        if (
          command.operation === "complete" &&
          (state.completionCriteria ?? []).some(
            (criterion) =>
              !state.evidence.some(
                (item) =>
                  item.type === "checklist" &&
                  item.status !== "rejected" &&
                  item.status !== "superseded" &&
                  item.checklist?.[criterion] === true,
              ),
          )
        )
          throw problem(
            "EVIDENCE_REQUIREMENT_UNMET",
            "Every completion checklist item must be complete.",
          );
        if (
          command.operation === "complete" &&
          (state.evidencePolicy.reviewRequired ??
            state.evidencePolicy.reviewerApprovalRequired) &&
          state.action.status !== "awaiting-review"
        )
          throw problem(
            "EVIDENCE_REVIEW_REQUIRED",
            "Review-required Actions must be submitted for review before completion.",
          );
        if (
          command.operation === "complete" &&
          unresolvedDependencies(
            command.actionId,
            state.dependencies,
            state.relatedActions,
          ).length
        )
          throw problem(
            "ACTION_DEPENDENCY_UNRESOLVED",
            "Required dependencies remain incomplete.",
          );
        if (
          command.operation === "complete" &&
          state.blockers.some((item) => !item.resolvedAt)
        )
          throw problem(
            "BLOCKER_UNRESOLVED",
            "Active blockers prevent completion.",
          );
        const context = this.context(command);
        let action: PlatformAction;
        switch (command.operation) {
          case "start":
            action = state.action.start(context);
            break;
          case "submit-for-review":
            action = state.action.submitForReview(context);
            break;
          case "return-for-correction":
            action = state.action.returnForCorrection({
              ...context,
              reason: command.reason,
            });
            break;
          case "complete":
            action = state.action.complete(context);
            break;
          case "fail":
            action = state.action.fail({ ...context, reason: command.reason });
            break;
          case "retry":
            action = state.action.retry({ ...context, reason: command.reason });
            break;
          case "reopen":
            action = state.action.reopen({
              ...context,
              reason: command.reason,
            });
            break;
        }
        return {
          action,
          metadata: {
            operation: command.operation,
            ...(command.reason ? { reason: command.reason } : {}),
          },
        };
      },
      command,
    );
  }
  private async change(
    command: ControlContext,
    eventType: string,
    build: (
      state: ExecuteControlState,
    ) => Promise<
      Omit<ExecuteControlMutation, "activity" | "notifications"> &
        Readonly<{ metadata: Readonly<Record<string, unknown>> }>
    >,
    submittedInput?: unknown,
  ): Promise<ExecuteControlResult<ExecuteControlState>> {
    try {
      const state = await this.d.repository.get(
        command.workspaceId,
        command.actionId,
      );
      if (!state)
        return {
          ok: false,
          code: "ACTION_NOT_FOUND",
          message: "Action was not found.",
          retryable: false,
        };
      if (state.action.version.value !== command.expectedVersion)
        return {
          ok: false,
          code: "ACTION_VERSION_CONFLICT",
          message: "This Action changed in another session.",
          retryable: true,
          currentVersion: state.action.version.value,
          submittedInput,
        };
      const change = await build(state);
      const event = this.event(command, eventType, change.metadata);
      const notifications = this.notifications(state, eventType, command);
      const value = await this.d.repository.commit(
        command.workspaceId,
        command.actionId,
        command.expectedVersion,
        { ...change, activity: [event], notifications },
      );
      return { ok: true, value };
    } catch (error) {
      if (isProblem(error)) return { ok: false, ...error, submittedInput };
      if (error instanceof Error && error.name === "40001") {
        const current = await this.d.repository
          .get(command.workspaceId, command.actionId)
          .catch(() => null);
        return {
          ok: false,
          code: "ACTION_VERSION_CONFLICT",
          message: "This Action changed in another session.",
          retryable: true,
          ...(current ? { currentVersion: current.action.version.value } : {}),
          submittedInput,
        };
      }
      return {
        ok: false,
        code: "CONTROL_PERSISTENCE_FAILURE",
        message:
          "Execute could not save the change. No partial changes were applied.",
        retryable: true,
        submittedInput,
      };
    }
  }
  private context(command: ControlContext) {
    return {
      workspaceId: createWorkspaceId(command.workspaceId),
      expectedVersion: ActionVersion.create(command.expectedVersion),
      actor: command.actor,
      occurredAt: command.occurredAt,
      commandId: command.correlationId,
    };
  }
  private async work(command: ControlContext, state: ExecuteControlState) {
    if (
      !(await this.d.authorization.canWork({
        workspaceId: command.workspaceId,
        action: state.action,
        actor: command.actor,
      }))
    )
      throw problem(
        "ACTION_CONTROL_UNAUTHORIZED",
        "You are not authorized to perform this Action.",
      );
  }
  private async review(command: ControlContext, state: ExecuteControlState) {
    if (
      !(await this.d.authorization.canReview({
        workspaceId: command.workspaceId,
        action: state.action,
        actor: command.actor,
      }))
    )
      throw problem(
        "ACTION_CONTROL_UNAUTHORIZED",
        "You are not authorized to review this Action.",
      );
  }
  private async manage(command: ControlContext, state: ExecuteControlState) {
    if (
      !(await this.d.authorization.canManage({
        workspaceId: command.workspaceId,
        action: state.action,
        actor: command.actor,
      }))
    )
      throw problem(
        "ACTION_CONTROL_UNAUTHORIZED",
        "You are not authorized to manage this Action.",
      );
  }
  private event(
    command: ControlContext,
    eventType: string,
    metadata: Readonly<Record<string, unknown>>,
  ): ExecuteActivityEvent {
    return Object.freeze({
      id: this.d.createId(),
      workspaceId: command.workspaceId,
      entityType: "action",
      entityId: command.actionId,
      actionId: command.actionId,
      eventType,
      actor: command.actor,
      occurredAt: command.occurredAt,
      metadata,
      correlationId: command.correlationId,
    });
  }
  private notifications(
    state: ExecuteControlState,
    eventType: string,
    command: ControlContext,
  ): readonly ExecuteNotificationIntent[] {
    const values: ExecuteNotificationIntent[] = [];
    const add = (
      recipient: string,
      type: string,
      entityId: string,
      title: string,
    ) =>
      values.push(
        Object.freeze({
          id: this.d.createId(),
          workspaceId: command.workspaceId,
          recipientType: "user",
          recipientId: recipient,
          eventType: type,
          entityType: "action",
          entityId,
          templateVariables: Object.freeze({ title }),
          channel: "in-app",
          status: "pending",
          idempotencyKey: `${command.correlationId}:${type}:${recipient}:${entityId}`,
          attemptCount: 0,
          createdAt: command.occurredAt,
        }),
      );
    const recipient =
      state.action.activeAssignment?.assigneeId ?? state.action.owner.id;
    if (recipient)
      add(recipient, eventType, command.actionId, state.action.title);
    if (eventType === "action-complete") {
      for (const dependency of state.dependencies.filter(
        (item) =>
          item.dependsOnActionId === command.actionId && !item.overriddenAt,
      )) {
        const dependent = state.relatedActions.find(
          (item) => item.id.value === dependency.actionId,
        );
        if (!dependent) continue;
        const otherUnresolved = unresolvedDependencies(
          dependent.id.value,
          state.dependencies,
          state.relatedActions,
        ).filter((item) => item.dependsOnActionId !== command.actionId);
        const owner =
          dependent.activeAssignment?.assigneeId ?? dependent.owner.id;
        if (!otherUnresolved.length && owner)
          add(
            owner,
            "dependency-resolved",
            dependent.id.value,
            dependent.title,
          );
      }
    }
    return Object.freeze(values);
  }
}
type Problem = Readonly<{
  __problem: true;
  code: ExecuteControlFailureCode;
  message: string;
  retryable: false;
}>;
function problem(code: ExecuteControlFailureCode, message: string): Problem {
  return { __problem: true, code, message, retryable: false };
}
function isProblem(value: unknown): value is Problem {
  return Boolean(value && typeof value === "object" && "__problem" in value);
}
