import { createAdminClient } from "@/lib/supabase/admin";

type CleanupJob = Readonly<{
  id: string;
  state: string;
  guidebook_id: string | null;
  failure_class?: string | null;
}>;

export function creationCleanupEligibility(job: CleanupJob | null) {
  if (!job || job.failure_class === "reconciliation_required" || !["failed", "cancelled", "completed"].includes(job.state)) {
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
  }>,
) {
  const db = createAdminClient();
  const { data: job, error: jobError } = await db
    .from("guidebook_creation_jobs")
    .select("id,state,guidebook_id,failure_class")
    .eq("id", input.jobId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();
  if (jobError) throw jobError;
  const eligibility = creationCleanupEligibility(job);
  if (!job || !eligibility.allowed) {
    throw new Error("CREATION_CLEANUP_NOT_ALLOWED");
  }

  let archivedGuidebook = false;
  if (eligibility.archiveGuidebook) {
    const { data: guidebook, error: guidebookError } = await db
      .from("guidebooks")
      .select("id,status,revision")
      .eq("id", job.guidebook_id!)
      .eq("workspace_id", input.workspaceId)
      .maybeSingle();
    if (guidebookError) throw guidebookError;
    if (!guidebook) throw new Error("CREATION_CLEANUP_GUIDEBOOK_NOT_FOUND");
    if (!["draft", "archived"].includes(String(guidebook.status))) {
      throw new Error("CREATION_CLEANUP_NON_DRAFT_GUIDEBOOK");
    }
    if (guidebook.status !== "archived") {
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
      if (archiveError) throw archiveError;
      archivedGuidebook = true;
    }
  }

  const { data: sources, error } = await db
    .from("guidebook_creation_sources")
    .select("id,storage_path")
    .eq("job_id", input.jobId)
    .eq("workspace_id", input.workspaceId)
    .in("retention_state", ["active", "expired", "cleanup_queued"]);
  if (error) throw error;

  const paths = (sources ?? []).map((source) => String(source.storage_path));
  if (paths.length) {
    const { error: storageError } = await db.storage
      .from("guidebook-creation-sources")
      .remove(paths);
    if (storageError) throw storageError;
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
    if (updateError) throw updateError;
  }

  const { error: auditError } = await db
    .from("guidebook_creation_events")
    .insert({
      job_id: input.jobId,
      workspace_id: input.workspaceId,
      actor_profile_id: input.actorId,
      event_type: "resources.cleaned",
      correlation_id: input.correlationId,
      safe_metadata: { sourceCount: ids.length, archivedGuidebook },
    });
  if (auditError) throw auditError;
  return { sourceCount: ids.length, archivedGuidebook };
}
