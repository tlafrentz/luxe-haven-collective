"use server";
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

export async function createSnapshotProcurementBaseline(input: Readonly<{ snapshotId: string; idempotencyKey: string; correlationId: string }>) {
  await requireRole(["admin"]);
  const db = await createClient();
  const { data, error } = await db.rpc("create_or_replay_snapshot_procurement_baseline", { p_snapshot_id: input.snapshotId, p_idempotency_key: input.idempotencyKey, p_correlation_id: input.correlationId });
  if (error || !data) throw new Error("FS008E_PROCUREMENT_UNAVAILABLE");
  return data;
}
