"use server";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireRole, requireUser } from "@/lib/auth/session";

export async function approveFs008dPackage(input: Readonly<{ packageVersionId: string; expectedVersion: number; reason: string; correlationId: string; idempotencyKey: string }>) {
  await requireRole(["admin"]);
  const db = await createClient();
  const { data, error } = await db.rpc("approve_furnishing_package_version", { p_package_version_id: input.packageVersionId, p_expected_version: input.expectedVersion, p_reason: input.reason, p_correlation_id: input.correlationId, p_idempotency_key: input.idempotencyKey });
  if (error || !data) throw new Error("FS008D_APPROVAL_UNAVAILABLE");
  return data;
}

export async function createFs008dProjectSnapshot(input: Readonly<{ projectId: string; packageVersionId: string; snapshot: Record<string, unknown>; contentHash: string; correlationId: string; idempotencyKey: string }>) {
  await requireUser();
  const db = await createClient();
  const { data, error } = await db.rpc("create_furnishing_project_catalog_snapshot", { p_project_id: input.projectId, p_package_version_id: input.packageVersionId, p_snapshot: input.snapshot, p_content_hash: input.contentHash, p_correlation_id: input.correlationId, p_idempotency_key: input.idempotencyKey });
  if (error || !data) throw new Error("FS008D_SNAPSHOT_UNAVAILABLE");
  return data;
}
