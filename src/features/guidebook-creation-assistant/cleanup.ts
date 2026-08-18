import { createAdminClient } from "@/lib/supabase/admin";

type CleanupJob = Readonly<{
  id: string;
  state: string;
  guidebook_id: string | null;
  failure_class?: string | null;
}>;

export function creationCleanupEligibility(job: CleanupJob | null) {
  if (
    !job ||
    job.failure_class === "reconciliation_required" ||
    !["failed", "cancelled", "completed"].includes(job.state)
  ) {
    return { allowed: false as const, archiveGuidebook: false };
  }
  return {
    allowed: true as const,
    archiveGuidebook: Boolean(job.guidebook_id),
  };
}

export async function cleanupCreationResources(
  input: Readonly<{
    jobId: string;
    workspaceId: string;
    actorId: string;
    correlationId: string;
    controlledOwningDomainCleanup?: boolean;
  }>,
) {
  const db = createAdminClient();
  const { data: job, error: jobError } = await db
    .from("guidebook_creation_jobs")
    .select("id,state,guidebook_id,failure_class")
    .eq("id", input.jobId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();
  if (jobError) throw new Error("CREATION_CLEANUP_JOB_READ_FAILED");
  const eligibility = creationCleanupEligibility(job);
  if (!job || !eligibility.allowed) {
    throw new Error("CREATION_CLEANUP_NOT_ALLOWED");
  }

  let archivedGuidebook = false;
  let removedMedia = 0;
  let removedCommandReceipts = 0;
  if (eligibility.archiveGuidebook) {
    const { data: guidebook, error: guidebookError } = await db
      .from("guidebooks")
      .select("id,status,revision")
      .eq("id", job.guidebook_id!)
      .eq("workspace_id", input.workspaceId)
      .maybeSingle();
    if (guidebookError)
      throw new Error("CREATION_CLEANUP_GUIDEBOOK_READ_FAILED");
    if (!guidebook) throw new Error("CREATION_CLEANUP_GUIDEBOOK_NOT_FOUND");
    if (!["draft", "archived"].includes(String(guidebook.status))) {
      throw new Error("CREATION_CLEANUP_NON_DRAFT_GUIDEBOOK");
    }
    const { data: media, error: mediaError } = await db
      .from("guidebook_media_assets")
      .select("id,authoring_path")
      .eq("guidebook_id", guidebook.id)
      .eq("workspace_id", input.workspaceId);
    if (mediaError) throw new Error("CREATION_CLEANUP_MEDIA_READ_FAILED");
    const mediaPaths = (media ?? []).map((item) => String(item.authoring_path));
    if (mediaPaths.length) {
      const { error: mediaStorageError } = await db.storage
        .from("guidebook-authoring-media")
        .remove(mediaPaths);
      if (mediaStorageError)
        throw new Error("CREATION_CLEANUP_MEDIA_STORAGE_FAILED");
      const mediaIds = (media ?? []).map((item) => String(item.id));
      const { error: bindingError } = await db
        .from("guidebook_draft_media")
        .delete()
        .eq("guidebook_id", guidebook.id)
        .in("media_asset_id", mediaIds);
      if (bindingError)
        throw new Error("CREATION_CLEANUP_MEDIA_BINDING_FAILED");
      const { error: mediaDeleteError } = await db
        .from("guidebook_media_assets")
        .delete()
        .eq("guidebook_id", guidebook.id)
        .eq("workspace_id", input.workspaceId)
        .in("id", mediaIds);
      if (mediaDeleteError)
        throw new Error("CREATION_CLEANUP_MEDIA_DELETE_FAILED");
      removedMedia = mediaIds.length;
    }
    if (
      guidebook.status !== "archived" &&
      !input.controlledOwningDomainCleanup
    ) {
      const { error: archiveError } = await db.rpc(
        "archive_guidebook_canonical",
        {
          p_guidebook_id: guidebook.id,
          p_workspace_id: input.workspaceId,
          p_expected_revision: guidebook.revision,
          p_actor_id: input.actorId,
          p_command_id: `creation-cleanup:${input.jobId}`,
        },
      );
      if (archiveError)
        throw new Error("CREATION_CLEANUP_ARCHIVE_FAILED");
      archivedGuidebook = true;
    }
    if (input.controlledOwningDomainCleanup) {
      const { count, error: receiptError } = await db
        .from("guidebook_command_receipts")
        .delete({ count: "exact" })
        .eq("guidebook_id", guidebook.id);
      if (receiptError)
        throw new Error("CREATION_CLEANUP_COMMAND_RECEIPT_FAILED");
      removedCommandReceipts = count ?? 0;
    }
  }

  const { data: sources, error } = await db
    .from("guidebook_creation_sources")
    .select("id,storage_path")
    .eq("job_id", input.jobId)
    .eq("workspace_id", input.workspaceId)
    .in("retention_state", ["active", "expired", "cleanup_queued"]);
  if (error) throw new Error("CREATION_CLEANUP_SOURCE_READ_FAILED");

  const paths = (sources ?? []).map((source) => String(source.storage_path));
  if (paths.length) {
    const { error: storageError } = await db.storage
      .from("guidebook-creation-sources")
      .remove(paths);
    if (storageError)
      throw new Error("CREATION_CLEANUP_SOURCE_STORAGE_FAILED");
  }

  const now = new Date().toISOString();
  const ids = (sources ?? []).map((source) => source.id);
  if (ids.length) {
    const { error: updateError } = await db
      .from("guidebook_creation_sources")
      .update({ retention_state: "deleted", deleted_at: now })
      .in("id", ids)
      .eq("job_id", input.jobId)
      .eq("workspace_id", input.workspaceId);
    if (updateError)
      throw new Error("CREATION_CLEANUP_SOURCE_RETENTION_FAILED");
  }

  const { error: workError } = await db
    .from("guidebook_creation_work_items")
    .update({
      status: "cancelled",
      lease_owner: null,
      lease_expires_at: null,
      completed_at: now,
    })
    .eq("job_id", input.jobId)
    .eq("workspace_id", input.workspaceId)
    .in("status", ["queued", "processing", "retryable_failure"]);
  if (workError) throw new Error("CREATION_CLEANUP_WORK_CANCEL_FAILED");

  const { error: auditError } = await db
    .from("guidebook_creation_events")
    .insert({
      job_id: input.jobId,
      workspace_id: input.workspaceId,
      actor_profile_id: input.actorId,
      event_type: "resources.cleaned",
      correlation_id: input.correlationId,
      safe_metadata: {
        sourceCount: ids.length,
        removedMedia,
        removedCommandReceipts,
        archivedGuidebook,
      },
    });
  if (auditError) throw new Error("CREATION_CLEANUP_AUDIT_FAILED");
  return {
    sourceCount: ids.length,
    removedMedia,
    removedCommandReceipts,
    archivedGuidebook,
  };
}
