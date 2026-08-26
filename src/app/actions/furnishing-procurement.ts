"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertFurnishingEntitlement } from "./furnishing-access";
import { assertFurnishingActivationMutationDisabled } from "@/features/furnishing-studio/activation";
// Pending FS migrations are intentionally not represented in generated database types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const commandError = (error: unknown, fallback: string) => {
  const raw = String((error as { message?: unknown } | null)?.message ?? "");
  return raw.match(/(?:FS006|PROCUREMENT|BUDGET|RECEIPT|EXTERNAL|FURNISHING)_[A-Z0-9_]+/)?.[0] ?? fallback;
};
const without = (row: Row, keys: readonly string[]) => Object.fromEntries(Object.entries(row).filter(([key]) => !keys.includes(key)));
async function scope(projectId: string, write = false) {
  const { user, profile } = await requireUser();
  if (write) assertFurnishingActivationMutationDisabled();
  const db = createAdminClient();
  const { data: project, error } = await db.from("furnishing_projects").select("*,properties(*)").eq("id", projectId).single();
  if (error || !project) throw new Error("FURNISHING_PROJECT_NOT_FOUND");
  if (profile?.role !== "admin") {
    let membership = db.from("workspace_memberships").select("role").eq("workspace_id", project.workspace_id).eq("profile_id", profile?.id).eq("status", "active");
    if (write) membership = membership.in("role", ["owner", "administrator", "operator", "contributor"]);
    const { data } = await membership.maybeSingle();
    if (!data) throw new Error("FURNISHING_PROCUREMENT_ACCESS_DENIED");
  }
  await assertFurnishingEntitlement(String(project.workspace_id), profile?.role === "admin");
  return { db, project: project as Row, actorId: profile?.id ?? user.id, profile };
}
export async function getProcurementWorkspace(projectId: string) {
  const { db, project, profile } = await scope(projectId);
  const { data: baseline } = await db.from("furnishing_procurement_baselines").select("*").eq("project_id", projectId).order("version", { ascending: false }).limit(1).maybeSingle();
  if (!baseline) return { project, baseline: null, lines: [], budget: null, batches: [], orders: [], exceptions: [], events: [] };
  const [lines, budget, batches, orders, exceptions, events, retailers, shipments] = await Promise.all([
    db.from("furnishing_procurement_lines").select("*,furnishing_rooms(name),furnishing_products(name,default_media_asset_id,furnishing_product_offers!furnishing_product_offers_product_id_fkey(*,furnishing_retailers(name))),furnishing_product_offers(listed_price_minor,availability,last_verified_at,furnishing_retailers(name))").eq("baseline_id", baseline.id).order("description"),
    db.from("furnishing_project_procurement_budgets").select("*,furnishing_budget_allocations(*)").eq("baseline_id", baseline.id).order("version", { ascending: false }).limit(1).maybeSingle(),
    db.from("furnishing_purchase_batches").select("*,furnishing_retailers(name),furnishing_purchase_batch_lines(*)").eq("baseline_id", baseline.id).order("created_at", { ascending: false }),
    db.from("furnishing_procurement_orders").select("*").eq("baseline_id", baseline.id).order("created_at", { ascending: false }),
    db.from("furnishing_procurement_exceptions").select("*").eq("baseline_id", baseline.id).order("created_at", { ascending: false }),
    db.from("furnishing_procurement_events").select("*").eq("baseline_id", baseline.id).order("occurred_at", { ascending: false }).limit(100),
    db.from("furnishing_retailers").select("id,name").eq("status", "active").order("name"),
    db.from("furnishing_shipments").select("*,furnishing_procurement_orders!inner(baseline_id,vendor)").eq("furnishing_procurement_orders.baseline_id", baseline.id).order("created_at", { ascending: false }),
  ]);
  const failed = [lines, budget, batches, orders, exceptions, events, retailers, shipments].find((x) => x.error)?.error;
  if (failed) throw new Error("FURNISHING_OPERATION_FAILED");
  if (profile?.role !== "admin") return {
    project, baseline, lines: lines.data ?? [], budget: budget.data ?? null,
    batches: (batches.data ?? []).map((batch) => without(batch, ["authorization_snapshot", "readiness_snapshot"])),
    orders: (orders.data ?? []).map((order) => without(order, ["evidence", "terms_snapshot", "notes"])),
    exceptions: (exceptions.data ?? []).map((exception) => without(exception, ["detail", "resolution"])),
    events: [], retailers: retailers.data ?? [], shipments: shipments.data ?? [],
  };
  return { project, baseline, lines: lines.data ?? [], budget: budget.data ?? null, batches: batches.data ?? [], orders: orders.data ?? [], exceptions: exceptions.data ?? [], events: events.data ?? [], retailers: retailers.data ?? [], shipments: shipments.data ?? [] };
}
export async function generateProcurementBaselineAction(formData: FormData) {
  const projectId = text(formData, "projectId"), idempotencyKey = text(formData, "idempotencyKey") || crypto.randomUUID();
  const { db } = await scope(projectId);
  const { data: plan } = await db.from("furnishing_plans").select("id,version_number,approved_at,approval_snapshot").eq("project_id", projectId).eq("status", "approved").order("version_number", { ascending: false }).limit(1).maybeSingle();
  if (!plan || !plan.approved_at || !plan.approval_snapshot) throw new Error("FS006_APPROVED_PLAN_REQUIRED");
  const client = await createClient();
  const { data: baseline, error } = await client.rpc("create_or_replay_procurement_baseline", { p_input: { source_kind: "furnishing_plan", source_id: plan.id, expected_source_version: plan.version_number, correlation_id: crypto.randomUUID(), idempotency_key: idempotencyKey } });
  if (error || !baseline) throw new Error(commandError(error, "FS006_BASELINE_CREATE_FAILED"));
  revalidatePath(`/dashboard/furnishing/projects/${projectId}/procurement`); revalidatePath(`/admin/furnishing/projects/${projectId}/procurement`);
  const result = baseline as Row; return { id: String(result.id), alreadyGenerated: result.status === "replayed" };
}
export async function changeProcurementLineOfferAction(formData: FormData) {
  void formData; throw new Error("PROCUREMENT_SOURCE_LINEAGE_IMMUTABLE");
}
export async function submitPurchaseBatchAction(formData: FormData) {
  const projectId = text(formData, "projectId"), baselineId = text(formData, "baselineId"), retailerId = text(formData, "retailerId"), idempotencyKey = text(formData, "idempotencyKey") || crypto.randomUUID();
  const { db } = await scope(projectId);
  const { data: baseline } = await db.from("furnishing_procurement_baselines").select("version").eq("id", baselineId).eq("project_id", projectId).single();
  if (!baseline) throw new Error("PROCUREMENT_BASELINE_NOT_FOUND");
  const client=await createClient(),{error}=await client.rpc("create_or_replay_procurement_batch",{p_input:{baseline_id:baselineId,retailer_id:retailerId,expected_version:baseline.version,correlation_id:crypto.randomUUID(),idempotency_key:idempotencyKey}}); if(error)throw new Error(commandError(error,"FS006_BATCH_CREATE_FAILED"));
  revalidatePath(`/dashboard/furnishing/projects/${projectId}/procurement`); revalidatePath(`/admin/furnishing/projects/${projectId}/procurement`);
}
export async function authorizePurchaseBatchAction(formData: FormData) {
  const projectId = text(formData, "projectId"), batchId = text(formData, "batchId");
  const { db } = await scope(projectId);
  const { data: batch } = await db.from("furnishing_purchase_batches").select("id,version").eq("id", batchId).single();
  if (!batch) throw new Error("FS006_BATCH_NOT_FOUND");
  const client=await createClient(),{error}=await client.rpc("approve_furnishing_procurement_plan",{p_input:{batch_id:batchId,expected_version:batch.version,correlation_id:crypto.randomUUID(),idempotency_key:text(formData,"idempotencyKey")||`approve-${batchId}`}}); if(error)throw new Error(commandError(error,"FURNISHING_OPERATION_FAILED"));
  revalidatePath(`/dashboard/furnishing/projects/${projectId}/procurement`); revalidatePath(`/admin/furnishing/projects/${projectId}/procurement`);
}
export async function recordExternalOrderAction(formData: FormData) {
  const projectId = text(formData, "projectId"), batchId = text(formData, "batchId"), externalOrderId = text(formData, "externalOrderId"), orderDate = text(formData, "orderDate");
  if (!externalOrderId) throw new Error("FS006_EXTERNAL_ORDER_ID_REQUIRED");
  const { db } = await scope(projectId);
  const { data: batch } = await db.from("furnishing_purchase_batches").select("id,version").eq("id", batchId).single();
  if (!batch) throw new Error("FS006_BATCH_NOT_FOUND");
  const client=await createClient(),{error}=await client.rpc("record_external_retailer_order",{p_input:{batch_id:batchId,expected_version:batch.version,external_order_id:externalOrderId,order_date:orderDate,correlation_id:crypto.randomUUID(),idempotency_key:text(formData,"idempotencyKey")||`external-${batchId}-${externalOrderId}`}}); if(error)throw new Error(commandError(error,"FS006_ORDER_CREATE_FAILED"));
  revalidatePath(`/dashboard/furnishing/projects/${projectId}/procurement`); revalidatePath(`/admin/furnishing/projects/${projectId}/procurement`);
}
export async function recordReceivingAction(formData: FormData) {
  const projectId = text(formData, "projectId"), lineId = text(formData, "lineId"),
    receivedQuantity = Number(text(formData, "receivedQuantity")), acceptedQuantity = Number(text(formData, "acceptedQuantity")),
    condition = text(formData, "condition");
  if (!Number.isFinite(receivedQuantity) || receivedQuantity < 0 || !Number.isFinite(acceptedQuantity) || acceptedQuantity < 0 || acceptedQuantity > receivedQuantity) throw new Error("FS006_RECEIVING_QUANTITY_INVALID");
  const { db } = await scope(projectId);
  const { data: line } = await db.from("furnishing_procurement_lines").select("id,revision").eq("id", lineId).single();
  if (!line) throw new Error("FS006_LINE_NOT_FOUND");
  const client=await createClient(),{error}=await client.rpc("record_furnishing_procurement_receipt",{p_input:{line_id:lineId,expected_version:line.revision,received_quantity:receivedQuantity,accepted_quantity:acceptedQuantity,condition,correlation_id:crypto.randomUUID(),idempotency_key:text(formData,"idempotencyKey")||crypto.randomUUID()}}); if(error)throw new Error(commandError(error,"FURNISHING_OPERATION_FAILED"));
  revalidatePath(`/dashboard/furnishing/projects/${projectId}/procurement`); revalidatePath(`/admin/furnishing/projects/${projectId}/procurement`);
}
export async function saveProcurementBudgetAction(formData: FormData) {
  const projectId=text(formData,"projectId"), baselineId=text(formData,"baselineId"), base=Math.round(Number(text(formData,"baseAmount"))*100), contingency=Math.round(Number(text(formData,"contingency"))*100);
  if(!Number.isSafeInteger(base)||base<0||!Number.isSafeInteger(contingency)||contingency<0) throw new Error("FS006_BUDGET_INVALID");
  const {db}=await scope(projectId); const{data:baseline}=await db.from("furnishing_procurement_baselines").select("version").eq("id",baselineId).eq("project_id",projectId).single(); if(!baseline)throw new Error("PROCUREMENT_BASELINE_NOT_FOUND");
  const client=await createClient(),{error}=await client.rpc("reconcile_furnishing_procurement_budget",{p_input:{baseline_id:baselineId,expected_version:baseline.version,base_amount_minor:base,contingency_minor:contingency,correlation_id:crypto.randomUUID(),idempotency_key:text(formData,"idempotencyKey")||crypto.randomUUID()}}); if(error)throw new Error(commandError(error,"FURNISHING_OPERATION_FAILED")); revalidatePath(`/dashboard/furnishing/projects/${projectId}/procurement`); revalidatePath(`/admin/furnishing/projects/${projectId}/procurement`);
}
