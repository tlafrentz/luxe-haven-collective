import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Credentials = {
  owner: { id: string };
  workspaceId: string;
  customerAccountId: string;
  propertyId: string;
  controlledDesignationId: string;
  controlledRunId: string;
  controlledCorrelationId: string;
  candidateCommit: string;
};

const required = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
};
const url = required("NEXT_PUBLIC_SUPABASE_URL");
if (!["localhost", "127.0.0.1"].includes(new URL(url).hostname))
  throw new Error("FS008G_LOCAL_SUPABASE_REQUIRED");
const admin = createClient(url, required("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const credentials = JSON.parse(
  await readFile(required("FS008G_BROWSER_CREDENTIAL_FILE"), "utf8"),
) as Credentials;
const projectId = required("FS008G_CONTROLLED_PROJECT_ID");

async function must<T>(promise: PromiseLike<{ data: T; error: unknown }>, code: string) {
  const result = await promise;
  if (result.error) throw new Error(`${code}:${JSON.stringify(result.error)}`);
  return result.data;
}

async function count(
  db: SupabaseClient,
  table: string,
  column: string,
  value: string,
  activeColumn?: string,
) {
  let query = db.from(table).select("id", { count: "exact", head: true }).eq(column, value);
  if (activeColumn) query = query.is(activeColumn, null);
  const result = await query;
  if (result.error) throw new Error(`COUNT_${table}:${result.error.message}`);
  return result.count ?? 0;
}

async function manifestCounts() {
  const baselines = await must(
    admin.from("furnishing_procurement_baselines").select("id").eq("project_id", projectId),
    "BASELINE_IDS",
  ) as Array<{ id: string }>;
  const baselineIds = baselines.map((row) => row.id);
  const batches = baselineIds.length
    ? await must(
        admin.from("furnishing_purchase_batches").select("id").in("baseline_id", baselineIds).is("archived_at", null),
        "BATCH_IDS",
      ) as Array<{ id: string }>
    : [];
  const batchIds = batches.map((row) => row.id);
  const indirect = async (table: string, foreignKey: string, activeColumn = "archived_at") => {
    if (!baselineIds.length) return 0;
    let query = admin.from(table).select("id", { count: "exact", head: true }).in(foreignKey, baselineIds);
    query = query.is(activeColumn, null);
    const result = await query;
    if (result.error) throw new Error(`COUNT_${table}:${result.error.message}`);
    return result.count ?? 0;
  };
  return {
    snapshots: await count(admin, "fs008d_project_catalog_snapshots", "project_id", projectId, "archived_at"),
    snapshotItems: await count(admin, "fs008d_snapshot_items", "project_id", projectId, "archived_at"),
    baselines: await count(admin, "furnishing_procurement_baselines", "project_id", projectId, "archived_at"),
    lines: await indirect("furnishing_procurement_lines", "baseline_id"),
    batches: batches.length,
    batchLines: batchIds.length
      ? await (async () => {
          const result = await admin.from("furnishing_purchase_batch_lines").select("id", { count: "exact", head: true }).in("batch_id", batchIds).is("archived_at", null);
          if (result.error) throw new Error(`COUNT_furnishing_purchase_batch_lines:${result.error.message}`);
          return result.count ?? 0;
        })()
      : 0,
    orders: await count(admin, "furnishing_procurement_orders", "project_id", projectId, "archived_at"),
    receipts: await indirect("furnishing_procurement_receipts", "baseline_id"),
    exceptions: await indirect("furnishing_procurement_exceptions", "baseline_id"),
    budgets: await count(admin, "furnishing_project_procurement_budgets", "project_id", projectId, "archived_at"),
    adjustments: await indirect("furnishing_procurement_adjustments", "baseline_id"),
    plans: await count(admin, "furnishing_plans", "project_id", projectId),
    projects: await count(admin, "furnishing_projects", "id", projectId),
  };
}

const binding = {
  designation_id: credentials.controlledDesignationId,
  project_id: projectId,
  customer_account_id: credentials.customerAccountId,
  property_id: credentials.propertyId,
  controlled_run_id: credentials.controlledRunId,
  correlation_id: credentials.controlledCorrelationId,
  created_by: credentials.owner.id,
  candidate_commit: credentials.candidateCommit,
};
await must(admin.rpc("bind_fs008g_controlled_project", { p_input: binding }), "CONTROLLED_PROJECT_BIND");
const before = await manifestCounts();
const command = {
  ...binding,
  workspace_id: credentials.workspaceId,
  actor_id: credentials.owner.id,
  reason: "FS-008G controlled service cleanup",
  idempotency_key: `fs008g-cleanup:${credentials.controlledRunId}`,
};
const cleaned = await must(admin.rpc("cleanup_fs008g_synthetic_project", { p_input: command }), "CONTROLLED_CLEANUP") as {
  id: string; status: string; reconciliation: { archivedCounts: Record<string, number> };
};
const after = await manifestCounts();
for (const [key, expected] of Object.entries(cleaned.reconciliation.archivedCounts)) {
  if (before[key as keyof typeof before] !== Number(expected))
    throw new Error(`CLEANUP_MANIFEST_BEFORE_MISMATCH:${key}`);
}
for (const key of ["snapshots", "snapshotItems", "baselines", "lines", "batches", "batchLines", "orders", "receipts", "exceptions", "budgets", "adjustments"] as const) {
  if (after[key] !== 0) throw new Error(`CLEANUP_MANIFEST_AFTER_MISMATCH:${key}:${after[key]}`);
}
const replay = await must(admin.rpc("cleanup_fs008g_synthetic_project", { p_input: command }), "CONTROLLED_CLEANUP_REPLAY") as { id: string; status: string; reconciliation: unknown };
if (cleaned.status !== "clean" || replay.status !== "already_cleaned" || replay.id !== cleaned.id || JSON.stringify(replay.reconciliation) !== JSON.stringify(cleaned.reconciliation))
  throw new Error("CLEANUP_REPLAY_RECONCILIATION_FAILED");
const designation = await must(admin.from("furnishing_controlled_fixture_designations").select("cleaned_at,revoked_at").eq("id", credentials.controlledDesignationId).single(), "DESIGNATION_FINAL") as { cleaned_at: string | null; revoked_at: string | null };
if (!designation.cleaned_at || !designation.revoked_at) throw new Error("DESIGNATION_NOT_FINALIZED");
process.stdout.write(JSON.stringify({ status: "passed", cleanupRunId: cleaned.id, before, after, replay: replay.status, designation: "revoked", nonce: randomUUID() }));
