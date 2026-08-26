"use server";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

export async function createSnapshotProcurementBaseline(input: Readonly<{ snapshotId: string; expectedSourceVersion: number; idempotencyKey: string; correlationId: string }>) {
  await requireRole(["admin"]);
  const db = await createClient();
  const { data, error } = await db.rpc("create_or_replay_procurement_baseline", { p_input: { source_kind: "catalog_snapshot", source_id: input.snapshotId, expected_source_version: input.expectedSourceVersion, idempotency_key: input.idempotencyKey, correlation_id: input.correlationId } });
  if (error || !data) throw new Error("FS008E_PROCUREMENT_UNAVAILABLE");
  return data;
}
