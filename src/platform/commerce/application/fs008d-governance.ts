import type { SupabaseClient } from "@supabase/supabase-js";

export async function approveFs008dPackageVersion(
  db: SupabaseClient,
  input: Readonly<{
    packageVersionId: string;
    expectedVersion: number;
    reason: string;
    correlationId: string;
    idempotencyKey: string;
  }>,
) {
  const { data, error } = await db.rpc("approve_furnishing_package_version", {
    p_package_version_id: input.packageVersionId,
    p_expected_version: input.expectedVersion,
    p_reason: input.reason,
    p_correlation_id: input.correlationId,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error || !data) throw new Error("FS008D_APPROVAL_UNAVAILABLE");
  return data;
}

export async function createFs008dProjectCatalogSnapshot(
  db: SupabaseClient,
  input: Readonly<{
    projectId: string;
    correlationId: string;
    idempotencyKey: string;
  }>,
) {
  const { data, error } = await db.rpc(
    "create_furnishing_project_catalog_snapshot",
    {
      p_project_id: input.projectId,
      p_correlation_id: input.correlationId,
      p_idempotency_key: input.idempotencyKey,
    },
  );
  if (error || !data) throw new Error("FS008D_SNAPSHOT_UNAVAILABLE");
  return data;
}
