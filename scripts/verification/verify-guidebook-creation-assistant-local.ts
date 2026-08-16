import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.LOCAL_SUPABASE_URL;
const anonKey = process.env.LOCAL_SUPABASE_ANON_KEY;
const serviceKey = process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY;
if (!url || !anonKey || !serviceKey) throw new Error("LOCAL_SUPABASE_CONFIGURATION_REQUIRED");

const service = createClient(url, serviceKey, { auth: { persistSession: false } });
const password = `Local-${randomUUID()}-Aa1!`;
const run = randomUUID().slice(0, 8);
const ids = {
  ownerA: randomUUID(), ownerB: randomUUID(), admin: randomUUID(), viewer: randomUUID(),
  workspaceA: randomUUID(), workspaceB: randomUUID(), propertyA: randomUUID(), propertyB: randomUUID(),
  jobA: randomUUID(), jobB: randomUUID(), sourceA: randomUUID(), sourceB: randomUUID(),
  attemptA: randomUUID(), attemptB: randomUUID(), factA: randomUUID(), factB: randomUUID(),
  guidebookA: randomUUID(), guidebookB: randomUUID(),
};

async function user(id: string, label: string, role: "owner" | "admin" | "cleaner") {
  const email = `creation-${run}-${label}@example.test`;
  const { error } = await service.auth.admin.createUser({ id, email, password, email_confirm: true, user_metadata: { role } });
  if (error) throw error;
  if (role === "admin") {
    const promoted = await service.from("profiles").update({ role: "admin" }).eq("id", id);
    if (promoted.error) throw promoted.error;
  }
  const client = createClient(url!, anonKey!, { auth: { persistSession: false } });
  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error) throw signed.error;
  return client;
}

async function insert(table: string, values: unknown) {
  const { error } = await service.from(table).insert(values as never);
  if (error) throw new Error(`${table}: ${error.message}`);
}

async function count(client: SupabaseClient, table: string) {
  const key = table === "guidebook_creation_jobs" ? "id" : "job_id";
  const { data, error } = await client.from(table).select("id").in(key, [ids.jobA, ids.jobB]);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.length;
}

async function countOrDenied(client: SupabaseClient, table: string) {
  const key = table === "guidebook_creation_jobs" ? "id" : "job_id";
  const { data, error } = await client.from(table).select("id").in(key, [ids.jobA, ids.jobB]);
  if (error?.code === "42501") return 0;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.length;
}

const tables = [
  "guidebook_creation_jobs", "guidebook_creation_attempts", "guidebook_creation_sources",
  "guidebook_creation_facts", "guidebook_creation_confirmations", "guidebook_creation_artifacts",
  "guidebook_creation_events", "guidebook_creation_work_items",
];
let stage = "setup";

async function main() {
  stage = "users";
  const ownerA = await user(ids.ownerA, "owner-a", "owner");
  const ownerB = await user(ids.ownerB, "owner-b", "owner");
  const admin = await user(ids.admin, "admin", "admin");
  const viewer = await user(ids.viewer, "viewer", "cleaner");
  stage = "owners";
  await insert("owners", [
    { id: ids.workspaceA, profile_id: ids.ownerA, company_name: "Controlled A" },
    { id: ids.workspaceB, profile_id: ids.ownerB, company_name: "Controlled B" },
  ]);
  stage = "memberships";
  await insert("workspace_memberships", [
    { workspace_id: ids.workspaceA, profile_id: ids.ownerA, role: "owner", status: "active", property_access_mode: "all", joined_at: new Date().toISOString() },
    { workspace_id: ids.workspaceB, profile_id: ids.ownerB, role: "owner", status: "active", property_access_mode: "all", joined_at: new Date().toISOString() },
    { workspace_id: ids.workspaceA, profile_id: ids.viewer, role: "viewer", status: "active", property_access_mode: "none", joined_at: new Date().toISOString() },
  ]);
  stage = "properties";
  const propertyInsert = await service.from("properties").insert([
    { id: ids.propertyA, owner_id: ids.workspaceA, name: "Controlled A", slug: `controlled-a-${run}`, description: "Controlled", city: "Austin", state: "TX", status: "draft" },
    { id: ids.propertyB, owner_id: ids.workspaceB, name: "Controlled B", slug: `controlled-b-${run}`, description: "Controlled", city: "Austin", state: "TX", status: "draft" },
  ]);
  if (propertyInsert.error) throw new Error(`properties: ${propertyInsert.error.message}`);
  stage = "guidebooks";
  await insert("guidebooks", [
    { id: ids.guidebookA, workspace_id: ids.workspaceA, property_id: ids.propertyA, title: "Controlled A", status: "draft", public_slug: `${run}a${randomUUID().replaceAll("-", "")}` },
    { id: ids.guidebookB, workspace_id: ids.workspaceB, property_id: ids.propertyB, title: "Controlled B", status: "draft", public_slug: `${run}b${randomUUID().replaceAll("-", "")}` },
  ]);
  const now = new Date().toISOString();
  stage = "jobs";
  await insert("guidebook_creation_jobs", [
    { id: ids.jobA, workspace_id: ids.workspaceA, property_id: ids.propertyA, guidebook_id: ids.guidebookA, requested_by_profile_id: ids.ownerA, requested_by_role: "owner", state: "failed", current_stage: "generation", idempotency_key: `job-a-${run}` },
    { id: ids.jobB, workspace_id: ids.workspaceB, property_id: ids.propertyB, guidebook_id: ids.guidebookB, requested_by_profile_id: ids.ownerB, requested_by_role: "owner", state: "failed", current_stage: "generation", idempotency_key: `job-b-${run}` },
  ]);
  stage = "attempts";
  await insert("guidebook_creation_attempts", [
    { id: ids.attemptA, job_id: ids.jobA, workspace_id: ids.workspaceA, attempt_number: 1, stage: "generation", status: "terminal_failure", provider_key: "deterministic", idempotency_key: `attempt-a-${run}` },
    { id: ids.attemptB, job_id: ids.jobB, workspace_id: ids.workspaceB, attempt_number: 1, stage: "generation", status: "terminal_failure", provider_key: "deterministic", idempotency_key: `attempt-b-${run}` },
  ]);
  const pathA = `${ids.workspaceA}/${ids.jobA}/${ids.sourceA}/source.txt`;
  const pathB = `${ids.workspaceB}/${ids.jobB}/${ids.sourceB}/source.txt`;
  stage = "sources";
  await insert("guidebook_creation_sources", [
    { id: ids.sourceA, job_id: ids.jobA, workspace_id: ids.workspaceA, source_type: "text", original_filename: "source.txt", storage_path: pathA, media_type: "text/plain", byte_size: 10, integrity_sha256: "a".repeat(64), created_by_profile_id: ids.ownerA },
    { id: ids.sourceB, job_id: ids.jobB, workspace_id: ids.workspaceB, source_type: "text", original_filename: "source.txt", storage_path: pathB, media_type: "text/plain", byte_size: 10, integrity_sha256: "b".repeat(64), created_by_profile_id: ids.ownerB },
  ]);
  stage = "facts";
  await insert("guidebook_creation_facts", [
    { id: ids.factA, job_id: ids.jobA, workspace_id: ids.workspaceA, category: "arrival", field_key: "parking", normalized_value: "controlled", review_status: "confirmed", sensitivity: "internal", high_risk: true, reviewed_by_profile_id: ids.ownerA, reviewed_at: now },
    { id: ids.factB, job_id: ids.jobB, workspace_id: ids.workspaceB, category: "arrival", field_key: "parking", normalized_value: "controlled", review_status: "confirmed", sensitivity: "internal", high_risk: true, reviewed_by_profile_id: ids.ownerB, reviewed_at: now },
  ]);
  stage = "confirmations";
  await insert("guidebook_creation_confirmations", [
    { job_id: ids.jobA, workspace_id: ids.workspaceA, fact_id: ids.factA, confirmed_by_profile_id: ids.ownerA },
    { job_id: ids.jobB, workspace_id: ids.workspaceB, fact_id: ids.factB, confirmed_by_profile_id: ids.ownerB },
  ]);
  stage = "artifacts";
  await insert("guidebook_creation_artifacts", [
    { job_id: ids.jobA, workspace_id: ids.workspaceA, attempt_id: ids.attemptA, guidebook_id: ids.guidebookA, draft_revision: 1, artifact_type: "initial_draft", draft_snapshot: { controlled: true } },
    { job_id: ids.jobB, workspace_id: ids.workspaceB, attempt_id: ids.attemptB, guidebook_id: ids.guidebookB, draft_revision: 1, artifact_type: "initial_draft", draft_snapshot: { controlled: true } },
  ]);
  stage = "events";
  await insert("guidebook_creation_events", [{ job_id: ids.jobA, workspace_id: ids.workspaceA, actor_profile_id: ids.ownerA, event_type: "controlled", correlation_id: randomUUID() }, { job_id: ids.jobB, workspace_id: ids.workspaceB, actor_profile_id: ids.ownerB, event_type: "controlled", correlation_id: randomUUID() }]);
  stage = "work-items";
  await insert("guidebook_creation_work_items", [{ job_id: ids.jobA, workspace_id: ids.workspaceA, stage: "generation", idempotency_key: `work-a-${run}` }, { job_id: ids.jobB, workspace_id: ids.workspaceB, stage: "generation", idempotency_key: `work-b-${run}` }]);
  stage = "uploads";
  for (const [path, body] of [[pathA, "controlled-a"], [pathB, "controlled-b"]] as const) {
    const result = await service.storage.from("guidebook-creation-sources").upload(
      path,
      new Blob([body], { type: "text/plain" }),
      { contentType: "text/plain" },
    );
    if (result.error) throw result.error;
  }

  for (const table of tables) {
    stage = `rls:${table}`;
    if (await count(ownerA, table) !== 1) throw new Error(`OWNER_SCOPE_FAILED:${table}`);
    if (await count(ownerB, table) !== 1) throw new Error(`WRONG_CUSTOMER_FAILED:${table}`);
    if (await count(admin, table) !== 2) throw new Error(`ADMIN_SCOPE_FAILED:${table}`);
    if (await count(viewer, table) !== 0) throw new Error(`UNAUTHORIZED_STAFF_FAILED:${table}`);
    if (await countOrDenied(createClient(url!, anonKey!, { auth: { persistSession: false } }), table) !== 0) throw new Error(`ANON_SCOPE_FAILED:${table}`);
  }
  stage = "storage";
  if ((await ownerA.storage.from("guidebook-creation-sources").download(pathA)).error) throw new Error("OWNER_STORAGE_FAILED");
  if (!(await ownerB.storage.from("guidebook-creation-sources").download(pathA)).error) throw new Error("CROSS_TENANT_STORAGE_FAILED");
  if (!(await createClient(url!, anonKey!).storage.from("guidebook-creation-sources").download(pathA)).error) throw new Error("ANON_STORAGE_FAILED");

  await service.from("workspace_memberships").update({ status: "removed" }).eq("workspace_id", ids.workspaceA).eq("profile_id", ids.ownerA);
  stage = "revoked-access";
  if (await count(ownerA, "guidebook_creation_jobs") !== 0) throw new Error("REVOKED_ACCESS_FAILED");
  await service.from("workspace_memberships").update({ status: "active" }).eq("workspace_id", ids.workspaceA).eq("profile_id", ids.ownerA);

  const { cleanupCreationResources } = await import("@/features/guidebook-creation-assistant/cleanup");
  stage = "cleanup";
  await cleanupCreationResources({ jobId: ids.jobA, workspaceId: ids.workspaceA, actorId: ids.ownerA, correlationId: randomUUID() });
  if (!(await service.storage.from("guidebook-creation-sources").download(pathA)).error) throw new Error("EXACT_CLEANUP_SOURCE_RETAINED");
  if ((await service.storage.from("guidebook-creation-sources").download(pathB)).error) throw new Error("EXACT_CLEANUP_CROSSED_OWNER");
  const cleaned = await service.from("guidebook_creation_sources").select("retention_state").eq("id", ids.sourceA).single();
  if (cleaned.data?.retention_state !== "deleted") throw new Error("EXACT_CLEANUP_STATE_FAILED");
  console.log(JSON.stringify({ status: "passed", tables: tables.length, personas: 6, privateStorage: true, exactCleanup: true }));
}

main().catch((error) => {
  const candidate = error as { message?: unknown; code?: unknown; status?: unknown } | null;
  const message = error instanceof Error
    ? error.message
    : [candidate?.message, candidate?.code, candidate?.status].filter(Boolean).join(":") || JSON.stringify(error);
  console.error(`${stage}:${message || "LOCAL_VERIFICATION_FAILED"}`);
  process.exitCode = 1;
});
