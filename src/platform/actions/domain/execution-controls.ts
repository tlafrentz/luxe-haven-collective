import type { ActionActor } from "./action-actor";
import type { PlatformAction } from "./action";

export type ActionEvidenceType =
  | "photo"
  | "document"
  | "receipt-invoice"
  | "url"
  | "checklist"
  | "text-note"
  | "metric-snapshot"
  | "approval"
  | "system-event";
export type ActionEvidenceStatus =
  | "pending"
  | "submitted"
  | "accepted"
  | "rejected"
  | "superseded"
  | "not-required";
export type ActionEvidencePolicy = Readonly<{
  mode: "optional" | "at-least-one" | "specific";
  requiredTypes?: readonly ActionEvidenceType[];
  minimumPhotoCount?: number;
  beforeAndAfterPhotos?: boolean;
  reviewRequired?: boolean;
  reviewerApprovalRequired?: boolean;
}>;
export type ActionEvidence = Readonly<{
  id: string;
  workspaceId: string;
  actionId: string;
  type: ActionEvidenceType;
  status: ActionEvidenceStatus;
  storageReference?: string;
  referenceUrl?: string;
  caption?: string;
  originalFilename?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  integrityHash?: string;
  checklist?: Readonly<Record<string, boolean>>;
  metricSnapshot?: Readonly<Record<string, number>>;
  createdBy: string;
  createdAt: Date;
  submittedAt?: Date;
  reviewerId?: string;
  reviewedAt?: Date;
  rejectionReason?: string;
  supersededById?: string;
}>;
export type ActionBlockerCategory =
  | "awaiting-approval"
  | "awaiting-information"
  | "awaiting-vendor"
  | "access-unavailable"
  | "supply-unavailable"
  | "property-condition"
  | "technical-issue"
  | "financial-approval"
  | "dependency-incomplete"
  | "other";
export const DEFAULT_ACTION_BLOCKER_SEVERITY = "medium" as const;
export type ActionBlocker = Readonly<{
  id: string;
  workspaceId: string;
  actionId: string;
  category: ActionBlockerCategory;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  blockingParty?: string;
  identifiedAt: Date;
  expectedResolutionAt?: Date;
  resolutionNote?: string;
  resolvedById?: string;
  resolvedAt?: Date;
}>;
export type ActionDependency = Readonly<{
  workspaceId: string;
  actionId: string;
  dependsOnActionId: string;
  createdById: string;
  createdAt: Date;
  overrideReason?: string;
  overriddenById?: string;
  overriddenAt?: Date;
}>;

export function validateEvidencePolicy(
  policy: ActionEvidencePolicy,
  evidence: readonly ActionEvidence[],
  forCompletion = false,
): Readonly<{
  satisfied: boolean;
  reviewRequired: boolean;
  issues: readonly string[];
}> {
  const usable = evidence.filter(
    (item) => !["rejected", "superseded"].includes(item.status),
  );
  const issues: string[] = [];
  if (policy.mode === "at-least-one" && !usable.length)
    issues.push("At least one evidence item is required.");
  for (const type of policy.requiredTypes ?? [])
    if (!usable.some((item) => item.type === type))
      issues.push(`${type} evidence is required.`);
  if (
    (policy.minimumPhotoCount ?? 0) >
    usable.filter((item) => item.type === "photo").length
  )
    issues.push(`At least ${policy.minimumPhotoCount} photos are required.`);
  if (
    policy.beforeAndAfterPhotos &&
    !["before", "after"].every((label) =>
      usable.some(
        (item) =>
          item.type === "photo" && item.caption?.toLowerCase().includes(label),
      ),
    )
  )
    issues.push("Before-and-after photos are required.");
  const reviewRequired = Boolean(
    (policy.reviewRequired ?? policy.reviewerApprovalRequired) &&
      usable.some((item) => item.status !== "accepted"),
  );
  if (forCompletion && reviewRequired)
    issues.push("Evidence review is required before completion.");
  return Object.freeze({
    satisfied: issues.length === 0,
    reviewRequired,
    issues: Object.freeze(issues),
  });
}
export function assertDependencyCanBeAdded(
  actionId: string,
  dependsOnActionId: string,
  dependencies: readonly ActionDependency[],
): void {
  if (actionId === dependsOnActionId)
    throw new TypeError("An Action cannot depend on itself.");
  const graph = new Map<string, string[]>();
  for (const item of dependencies.filter((value) => !value.overriddenAt)) {
    const values = graph.get(item.actionId) ?? [];
    values.push(item.dependsOnActionId);
    graph.set(item.actionId, values);
  }
  graph.set(actionId, [...(graph.get(actionId) ?? []), dependsOnActionId]);
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (id: string): void => {
    if (visiting.has(id))
      throw new TypeError("Action dependencies cannot contain a cycle.");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of graph.get(id) ?? []) visit(next);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of graph.keys()) visit(id);
}
export function unresolvedDependencies(
  actionId: string,
  dependencies: readonly ActionDependency[],
  actions: readonly PlatformAction[],
): readonly ActionDependency[] {
  return Object.freeze(
    dependencies.filter(
      (item) =>
        item.actionId === actionId &&
        !item.overriddenAt &&
        actions.find((action) => action.id.value === item.dependsOnActionId)
          ?.status !== "completed",
    ),
  );
}
export function isActionable(
  action: PlatformAction,
  blockers: readonly ActionBlocker[],
  dependencies: readonly ActionDependency[],
  actions: readonly PlatformAction[],
): boolean {
  return (
    ["ready", "in-progress"].includes(action.status) &&
    !blockers.some(
      (item) => item.actionId === action.id.value && !item.resolvedAt,
    ) &&
    unresolvedDependencies(action.id.value, dependencies, actions).length === 0
  );
}
export function reviewEvidence(
  item: ActionEvidence,
  input: Readonly<{
    accepted: boolean;
    reason?: string;
    actor: ActionActor;
    occurredAt: Date;
  }>,
): ActionEvidence {
  if (item.status !== "submitted" && item.status !== "pending")
    throw new TypeError("Only pending or submitted evidence can be reviewed.");
  if (!input.accepted && !input.reason?.trim())
    throw new TypeError("Rejecting evidence requires a reason.");
  return Object.freeze({
    ...item,
    status: input.accepted ? "accepted" : "rejected",
    reviewerId: input.actor.id,
    reviewedAt: new Date(input.occurredAt),
    ...(input.accepted ? {} : { rejectionReason: input.reason!.trim() }),
  });
}
