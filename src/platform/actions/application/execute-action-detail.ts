import type {
  ActionActor,
  ActionBlocker,
  ActionDependency,
  ActionEvidence,
  PlatformAction,
} from "../domain";
import { unresolvedDependencies, validateEvidencePolicy } from "../domain";
import type { ExecuteActivityEvent } from "./execute-application";
import type {
  ExecuteControlAuthorization,
  ExecuteControlState,
} from "./execute-controls";

export type ExecuteNextCommand =
  | "start"
  | "add-evidence"
  | "submit-evidence"
  | "review-evidence"
  | "block"
  | "resolve-blocker"
  | "resume"
  | "submit-for-review"
  | "return-for-correction"
  | "complete"
  | "fail"
  | "retry"
  | "reopen"
  | "add-dependency"
  | "remove-dependency"
  | "override-dependency";
export type ExecuteActionDetail = Readonly<{
  id: string;
  version: number;
  title: string;
  description?: string;
  status: PlatformAction["status"];
  priority: PlatformAction["priority"];
  owner: PlatformAction["owner"];
  assignee?: Readonly<{ type: string; id?: string }>;
  propertyId?: string;
  planId?: string;
  deadline?: Date;
  decisionId?: string;
  expectedOutcome?: string;
  successMetric?: string;
  completionChecklist: readonly string[];
  evidencePolicy: ExecuteControlState["evidencePolicy"];
  evidence: readonly ActionEvidence[];
  dependencies: readonly ActionDependency[];
  dependentActions: readonly ActionDependency[];
  unresolvedDependencyIds: readonly string[];
  activeBlockers: readonly ActionBlocker[];
  resolvedBlockers: readonly ActionBlocker[];
  reviewState:
    | "not-required"
    | "preparing"
    | "awaiting-review"
    | "accepted"
    | "rejected";
  measurementPreparation: Readonly<{
    required: boolean;
    expectedOutcome?: string;
    successMetric?: string;
  }>;
  activity: readonly ExecuteActivityEvent[];
  validCommands: readonly ExecuteNextCommand[];
}>;

export async function projectExecuteActionDetail(
  input: Readonly<{
    state: ExecuteControlState;
    activity: readonly ExecuteActivityEvent[];
    actor: ActionActor;
    authorization: ExecuteControlAuthorization;
  }>,
): Promise<ExecuteActionDetail> {
  const { state } = input,
    action = state.action;
  const [canWork, canReview, canManage] = await Promise.all([
    input.authorization.canWork({
      workspaceId: action.workspaceId.value,
      action,
      actor: input.actor,
    }),
    input.authorization.canReview({
      workspaceId: action.workspaceId.value,
      action,
      actor: input.actor,
    }),
    input.authorization.canManage({
      workspaceId: action.workspaceId.value,
      action,
      actor: input.actor,
    }),
  ]);
  const evidenceGate = validateEvidencePolicy(
      state.evidencePolicy,
      state.evidence,
      true,
    ),
    activeBlockers = state.blockers.filter((item) => !item.resolvedAt),
    unresolved = unresolvedDependencies(
      action.id.value,
      state.dependencies,
      state.relatedActions,
    ),
    commands: ExecuteNextCommand[] = [];
  if (canWork) {
    if (["ready", "in-progress", "blocked"].includes(action.status))
      commands.push("add-evidence", "submit-evidence");
    if (["ready", "in-progress"].includes(action.status))
      commands.push("block");
    if (["in-progress", "blocked"].includes(action.status))
      commands.push("fail");
    if (action.status === "ready") commands.push("start");
    if (action.status === "blocked" && !activeBlockers.length)
      commands.push("resume");
    if (
      action.status === "in-progress" &&
      (
        state.evidencePolicy.reviewRequired ??
        state.evidencePolicy.reviewerApprovalRequired
      ) &&
      validateEvidencePolicy(state.evidencePolicy, state.evidence).satisfied
    )
      commands.push("submit-for-review");
    if (
      action.status === "in-progress" &&
      !activeBlockers.length &&
      !unresolved.length &&
      evidenceGate.satisfied
    )
      commands.push("complete");
    if (action.status === "failed") commands.push("retry");
  }
  if (canReview) {
    if (
      state.evidence.some((item) =>
        ["pending", "submitted"].includes(item.status),
      )
    )
      commands.push("review-evidence");
    if (action.status === "awaiting-review")
      commands.push(
        "return-for-correction",
        ...(evidenceGate.satisfied &&
        !unresolved.length &&
        !activeBlockers.length
          ? ["complete" as const]
          : []),
      );
  }
  if (canManage) {
    if (!["completed", "cancelled", "archived"].includes(action.status))
      commands.push(
        "add-dependency",
        "remove-dependency",
        "override-dependency",
        "resolve-blocker",
      );
    if (action.status === "completed") commands.push("reopen");
  }
  const decisionId = action.sources.find(
    (source) => source.type === "decision",
  )?.sourceId;
  return Object.freeze({
    id: action.id.value,
    version: action.version.value,
    title: action.title,
    ...(action.description ? { description: action.description } : {}),
    status: action.status,
    priority: action.priority,
    owner: action.owner,
    ...(action.activeAssignment
      ? {
          assignee: {
            type: action.activeAssignment.assigneeType,
            ...(action.activeAssignment.assigneeId
              ? { id: action.activeAssignment.assigneeId }
              : {}),
          },
        }
      : {}),
    ...(state.propertyId ? { propertyId: state.propertyId } : {}),
    ...(state.planId ? { planId: state.planId } : {}),
    ...(action.scheduleValue.due ? { deadline: action.scheduleValue.due } : {}),
    ...(decisionId ? { decisionId } : {}),
    ...(state.expectedOutcome
      ? { expectedOutcome: state.expectedOutcome }
      : {}),
    ...(state.successMetric ? { successMetric: state.successMetric } : {}),
    completionChecklist: Object.freeze([...(state.completionCriteria ?? [])]),
    evidencePolicy: state.evidencePolicy,
    evidence: Object.freeze([...state.evidence]),
    dependencies: Object.freeze(
      state.dependencies.filter((item) => item.actionId === action.id.value),
    ),
    dependentActions: Object.freeze(
      state.dependencies.filter(
        (item) => item.dependsOnActionId === action.id.value,
      ),
    ),
    unresolvedDependencyIds: Object.freeze(
      unresolved.map((item) => item.dependsOnActionId),
    ),
    activeBlockers: Object.freeze(activeBlockers),
    resolvedBlockers: Object.freeze(
      state.blockers.filter((item) => item.resolvedAt),
    ),
    reviewState:
      action.status === "awaiting-review"
        ? "awaiting-review"
        : state.evidence.some((item) => item.status === "rejected")
          ? "rejected"
          : (state.evidencePolicy.reviewRequired ??
              state.evidencePolicy.reviewerApprovalRequired)
            ? "preparing"
            : "not-required",
    measurementPreparation: Object.freeze({
      required: Boolean(state.expectedOutcome || state.successMetric),
      ...(state.expectedOutcome
        ? { expectedOutcome: state.expectedOutcome }
        : {}),
      ...(state.successMetric ? { successMetric: state.successMetric } : {}),
    }),
    activity: Object.freeze(
      [...input.activity].sort(
        (a, b) => a.occurredAt.getTime() - b.occurredAt.getTime(),
      ),
    ),
    validCommands: Object.freeze([...new Set(commands)]),
  });
}
