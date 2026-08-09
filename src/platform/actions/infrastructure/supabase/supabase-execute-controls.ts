import {
  createActionId,
  createWorkspaceId,
  type ActionBlocker,
  type ActionDependency,
  type ActionEvidence,
  type ActionEvidencePolicy,
} from "../../domain";
import type {
  ExecuteControlMutation,
  ExecuteControlRepository,
  ExecuteControlState,
} from "../../application";
import type {
  ExecuteActivityEvent,
  ExecuteNotificationIntent,
} from "../../application";
import { mapPlatformActionToPersistenceRows } from "./action-persistence-mapper";
import { SupabasePlatformActionRepository } from "./supabase-platform-action-repository";
import type { ExecuteSupabaseClient } from "./supabase-execute-application";

export class SupabaseExecuteControlRepository
  implements ExecuteControlRepository
{
  public constructor(
    private readonly client: ExecuteSupabaseClient,
    private readonly actions = new SupabasePlatformActionRepository(client),
  ) {}
  public async get(
    workspaceId: string,
    actionId: string,
  ): Promise<ExecuteControlState | null> {
    const action = await this.actions.findById({
      workspaceId: createWorkspaceId(workspaceId),
      actionId: createActionId(actionId),
    });
    if (!action) return null;
    const [evidence, blockers, dependencies, related] = await Promise.all([
      this.rows("platform_action_evidence", workspaceId, "action_id", actionId),
      this.rows("platform_action_blockers", workspaceId, "action_id", actionId),
      this.rows("platform_action_dependencies", workspaceId),
      this.actions.find({ workspaceId: createWorkspaceId(workspaceId) }),
    ]);
    const rowResult = await this.client
      .from("platform_actions")
      .select(
        "property_id,plan_id,evidence_policy,completion_criteria,expected_outcome,measurement_requirement",
      )
      .eq("workspace_id", workspaceId)
      .eq("id", actionId)
      .limit(1);
    if (rowResult.error)
      throw new Error("Execute Action control context could not load.");
    const row = records(rowResult.data)[0] ?? {};
    return Object.freeze({
      action,
      evidencePolicy: policy(row.evidence_policy),
      evidence: Object.freeze(evidence.map(mapEvidence)),
      blockers: Object.freeze(blockers.map(mapBlocker)),
      dependencies: Object.freeze(dependencies.map(mapDependency)),
      relatedActions: related.all(),
      ...(Array.isArray(row.completion_criteria)
        ? {
            completionCriteria: row.completion_criteria.filter(
              (item): item is string => typeof item === "string",
            ),
          }
        : {}),
      ...(row.property_id ? { propertyId: String(row.property_id) } : {}),
      ...(row.plan_id ? { planId: String(row.plan_id) } : {}),
      ...(row.expected_outcome
        ? { expectedOutcome: String(row.expected_outcome) }
        : {}),
      ...(row.measurement_requirement &&
      typeof row.measurement_requirement === "object" &&
      "successMetric" in row.measurement_requirement
        ? {
            successMetric: String(
              (row.measurement_requirement as Record<string, unknown>)
                .successMetric,
            ),
          }
        : {}),
    });
  }
  public async commit(
    workspaceId: string,
    actionId: string,
    expectedVersion: number,
    mutation: ExecuteControlMutation,
  ): Promise<ExecuteControlState> {
    const result = await this.client.rpc("apply_execute_action_control", {
      p_workspace_id: workspaceId,
      p_action_id: actionId,
      p_expected_version: expectedVersion,
      p_action_payload: mutation.action
        ? mapPlatformActionToPersistenceRows(mutation.action)
        : null,
      p_evidence_upserts: (mutation.evidenceUpserts ?? []).map(evidenceRow),
      p_blocker_upserts: (mutation.blockerUpserts ?? []).map(blockerRow),
      p_dependency_upserts: (mutation.dependencyUpserts ?? []).map(
        dependencyRow,
      ),
      p_dependency_deletes: mutation.dependencyDeletes ?? [],
      p_activity_events: mutation.activity.map(activityRow),
      p_notification_intents: mutation.notifications.map(notificationRow),
    });
    if (result.error) {
      const error = new Error(
        result.error.code === "40001"
          ? "Action version conflict."
          : "Execute control persistence failed.",
      );
      error.name = result.error.code ?? "EXECUTE_CONTROL_PERSISTENCE_FAILURE";
      throw error;
    }
    const state = await this.get(workspaceId, actionId);
    if (!state)
      throw new Error("Execute Action disappeared after persistence.");
    return state;
  }
  private async rows(
    table: string,
    workspaceId: string,
    column?: string,
    value?: string,
  ) {
    let query = this.client
      .from(table)
      .select("*")
      .eq("workspace_id", workspaceId);
    if (column && value) query = query.eq(column, value);
    const result = await query;
    if (result.error)
      throw new Error("Execute control records could not load.");
    return records(result.data);
  }
}
function records(value: unknown): Readonly<Record<string, unknown>>[] {
  return Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>[])
    : [];
}
function date(value: unknown) {
  const result = new Date(String(value));
  if (Number.isNaN(result.getTime()))
    throw new TypeError("Execute control timestamp is invalid.");
  return result;
}
function policy(value: unknown): ActionEvidencePolicy {
  if (!value || typeof value !== "object") return { mode: "optional" };
  const row = value as Record<string, unknown>;
  return Object.freeze({
    mode: ["optional", "at-least-one", "specific"].includes(String(row.mode))
      ? (String(row.mode) as ActionEvidencePolicy["mode"])
      : "optional",
    ...(Array.isArray(row.requiredTypes)
      ? {
          requiredTypes:
            row.requiredTypes as ActionEvidencePolicy["requiredTypes"],
        }
      : {}),
    ...(Number.isInteger(row.minimumPhotoCount)
      ? { minimumPhotoCount: Number(row.minimumPhotoCount) }
      : {}),
    ...(typeof row.beforeAndAfterPhotos === "boolean"
      ? { beforeAndAfterPhotos: row.beforeAndAfterPhotos }
      : {}),
    ...(typeof row.reviewRequired === "boolean"
      ? { reviewRequired: row.reviewRequired }
      : {}),
    ...(typeof row.reviewerApprovalRequired === "boolean"
      ? { reviewerApprovalRequired: row.reviewerApprovalRequired }
      : {}),
  });
}
function mapEvidence(row: Readonly<Record<string, unknown>>): ActionEvidence {
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};
  return Object.freeze({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    actionId: String(row.action_id),
    type: String(row.evidence_type) as ActionEvidence["type"],
    status: String(row.review_status) as ActionEvidence["status"],
    ...(row.storage_reference
      ? { storageReference: String(row.storage_reference) }
      : {}),
    ...(row.reference_url ? { referenceUrl: String(row.reference_url) } : {}),
    ...(row.caption ? { caption: String(row.caption) } : {}),
    ...(row.original_filename
      ? { originalFilename: String(row.original_filename) }
      : {}),
    ...(row.mime_type ? { mimeType: String(row.mime_type) } : {}),
    ...(typeof row.file_size_bytes === "number"
      ? { fileSizeBytes: row.file_size_bytes }
      : {}),
    ...(row.integrity_hash
      ? { integrityHash: String(row.integrity_hash) }
      : {}),
    ...(metadata.checklist && typeof metadata.checklist === "object"
      ? { checklist: metadata.checklist as Readonly<Record<string, boolean>> }
      : {}),
    ...(metadata.metricSnapshot && typeof metadata.metricSnapshot === "object"
      ? {
          metricSnapshot: metadata.metricSnapshot as Readonly<
            Record<string, number>
          >,
        }
      : {}),
    createdBy: String(row.created_by_id),
    createdAt: date(row.created_at),
    ...(row.submitted_at ? { submittedAt: date(row.submitted_at) } : {}),
    ...(row.reviewer_id ? { reviewerId: String(row.reviewer_id) } : {}),
    ...(row.reviewed_at ? { reviewedAt: date(row.reviewed_at) } : {}),
    ...(row.rejection_reason
      ? { rejectionReason: String(row.rejection_reason) }
      : {}),
    ...(row.superseded_by_id
      ? { supersededById: String(row.superseded_by_id) }
      : {}),
  });
}
function mapBlocker(row: Readonly<Record<string, unknown>>): ActionBlocker {
  return Object.freeze({
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    actionId: String(row.action_id),
    category: String(row.category) as ActionBlocker["category"],
    description: String(row.description),
    severity: String(row.severity) as ActionBlocker["severity"],
    identifiedAt: date(row.identified_at),
    ...(row.blocking_party
      ? { blockingParty: String(row.blocking_party) }
      : {}),
    ...(row.expected_resolution_at
      ? { expectedResolutionAt: date(row.expected_resolution_at) }
      : {}),
    ...(row.resolution_note
      ? { resolutionNote: String(row.resolution_note) }
      : {}),
    ...(row.resolved_by_id ? { resolvedById: String(row.resolved_by_id) } : {}),
    ...(row.resolved_at ? { resolvedAt: date(row.resolved_at) } : {}),
  });
}
function mapDependency(
  row: Readonly<Record<string, unknown>>,
): ActionDependency {
  return Object.freeze({
    workspaceId: String(row.workspace_id),
    actionId: String(row.action_id),
    dependsOnActionId: String(row.depends_on_action_id),
    createdById: String(row.created_by_id),
    createdAt: date(row.created_at),
    ...(row.override_reason
      ? { overrideReason: String(row.override_reason) }
      : {}),
    ...(row.overridden_by_id
      ? { overriddenById: String(row.overridden_by_id) }
      : {}),
    ...(row.overridden_at ? { overriddenAt: date(row.overridden_at) } : {}),
  });
}
function evidenceRow(item: ActionEvidence) {
  return {
    workspace_id: item.workspaceId,
    id: item.id,
    action_id: item.actionId,
    evidence_type: item.type,
    storage_reference: item.storageReference ?? null,
    reference_url: item.referenceUrl ?? null,
    caption: item.caption ?? null,
    original_filename: item.originalFilename ?? null,
    mime_type: item.mimeType ?? null,
    file_size_bytes: item.fileSizeBytes ?? null,
    integrity_hash: item.integrityHash ?? null,
    created_by_id: item.createdBy,
    created_at: item.createdAt.toISOString(),
    review_status: item.status,
    reviewer_id: item.reviewerId ?? null,
    reviewed_at: item.reviewedAt?.toISOString() ?? null,
    rejection_reason: item.rejectionReason ?? null,
    submitted_at: item.submittedAt?.toISOString() ?? null,
    superseded_by_id: item.supersededById ?? null,
    metadata: {
      ...(item.checklist ? { checklist: item.checklist } : {}),
      ...(item.metricSnapshot ? { metricSnapshot: item.metricSnapshot } : {}),
    },
  };
}
function blockerRow(item: ActionBlocker) {
  return {
    workspace_id: item.workspaceId,
    id: item.id,
    action_id: item.actionId,
    category: item.category,
    description: item.description,
    blocking_party: item.blockingParty ?? null,
    identified_at: item.identifiedAt.toISOString(),
    expected_resolution_at: item.expectedResolutionAt?.toISOString() ?? null,
    severity: item.severity,
    resolution_note: item.resolutionNote ?? null,
    resolved_by_id: item.resolvedById ?? null,
    resolved_at: item.resolvedAt?.toISOString() ?? null,
  };
}
function dependencyRow(item: ActionDependency) {
  return {
    workspace_id: item.workspaceId,
    action_id: item.actionId,
    depends_on_action_id: item.dependsOnActionId,
    created_by_id: item.createdById,
    created_at: item.createdAt.toISOString(),
    override_reason: item.overrideReason ?? null,
    overridden_by_id: item.overriddenById ?? null,
    overridden_at: item.overriddenAt?.toISOString() ?? null,
  };
}
function activityRow(event: ExecuteActivityEvent) {
  return {
    workspace_id: event.workspaceId,
    id: event.id,
    entity_type: event.entityType,
    entity_id: event.entityId,
    action_id: event.actionId ?? null,
    event_type: event.eventType,
    actor_type: event.actor.type,
    actor_id: event.actor.id ?? null,
    occurred_at: event.occurredAt.toISOString(),
    metadata: event.metadata,
    correlation_id: event.correlationId,
    causation_id: null,
  };
}
function notificationRow(intent: ExecuteNotificationIntent) {
  return {
    workspace_id: intent.workspaceId,
    id: intent.id,
    recipient_type: intent.recipientType,
    recipient_id: intent.recipientId,
    event_type: intent.eventType,
    entity_type: intent.entityType,
    entity_id: intent.entityId,
    safe_template_variables: intent.templateVariables,
    channel: intent.channel,
    delivery_status: intent.status,
    idempotency_key: intent.idempotencyKey,
    attempt_count: intent.attemptCount,
    created_at: intent.createdAt.toISOString(),
  };
}
