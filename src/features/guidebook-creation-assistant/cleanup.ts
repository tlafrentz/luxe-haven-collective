import { createAdminClient } from "@/lib/supabase/admin";

export async function cleanupCreationResources(input: Readonly<{
  jobId: string;
  workspaceId: string;
  actorId: string;
  correlationId: string;
}>) {
  const db = createAdminClient();
  const { data: job, error: jobError } = await db
    .from("guidebook_creation_jobs")
    .select("id,state")
    .eq("id", input.jobId)
    .eq("workspace_id", input.workspaceId)
    .maybeSingle();
  if (jobError) throw jobError;
  if (!job || !["failed", "cancelled"].includes(String(job.state))) {
    throw new Error("CREATION_CLEANUP_NOT_ALLOWED");
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

  await db.from("guidebook_creation_events").insert({
    job_id: input.jobId,
    workspace_id: input.workspaceId,
    actor_profile_id: input.actorId,
    event_type: "resources.cleaned",
    correlation_id: input.correlationId,
    safe_metadata: { sourceCount: ids.length },
  });
  return { sourceCount: ids.length };
}
