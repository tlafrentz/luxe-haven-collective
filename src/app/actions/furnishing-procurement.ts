"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertFurnishingEntitlement } from "./furnishing-access";
// Pending FS migrations are intentionally not represented in generated database types yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
async function scope(projectId: string, write = false) {
  const { user, profile } = await requireUser();
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
  const { db, project } = await scope(projectId);
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
  return { project, baseline, lines: lines.data ?? [], budget: budget.data ?? null, batches: batches.data ?? [], orders: orders.data ?? [], exceptions: exceptions.data ?? [], events: events.data ?? [], retailers: retailers.data ?? [], shipments: shipments.data ?? [] };
}
export async function generateProcurementBaselineAction(formData: FormData) {
  const projectId = text(formData, "projectId"), idempotencyKey = text(formData, "idempotencyKey") || crypto.randomUUID();
  const { db, project, actorId } = await scope(projectId, true);
  const { data: plan } = await db.from("furnishing_plans").select("*,furnishing_product_selections(*,furnishing_rooms(name),furnishing_products(name,category))").eq("project_id", projectId).eq("status", "approved").order("version_number", { ascending: false }).limit(1).maybeSingle();
  if (!plan || !plan.approved_at || !plan.approval_snapshot) throw new Error("FS006_APPROVED_PLAN_REQUIRED");
  const existing = await db.from("furnishing_procurement_baselines").select("id").eq("source_plan_id", plan.id).maybeSingle();
  if (existing.data) return { id: existing.data.id, alreadyGenerated: true };
  const hash = `${plan.id}:${plan.revision}:${plan.updated_at}`;
  const { data: baseline, error } = await db.from("furnishing_procurement_baselines").insert({workspace_id: project.workspace_id,property_id: project.property_id,project_id: project.id,source_plan_id: plan.id,source_plan_version: plan.version_number,source_snapshot: { package: plan.package_snapshot, design: plan.design_snapshot, approval: plan.approval_snapshot },source_hash: hash,currency: plan.currency,status: "draft",estimated_subtotal_minor: plan.estimated_subtotal_minor,estimated_tax_minor: plan.estimated_tax_minor,estimated_shipping_minor: plan.estimated_shipping_minor,estimated_total_minor: plan.estimated_total_minor,idempotency_key: idempotencyKey,created_by: actorId}).select("id").single();
  if (error || !baseline) throw new Error("FS006_BASELINE_CREATE_FAILED");
  const selections = (plan.furnishing_product_selections ?? []) as Row[];
  const rows = selections.filter((s) => Number(s.resolved_quantity) > 0).map((s) => ({baseline_id: baseline.id,source_plan_line_id:s.id,room_id:s.room_id,product_id:s.product_id,selected_offer_id:s.selected_offer_id,category:s.furnishing_products?.category ?? "Unclassified",description:s.requirement_name ?? s.furnishing_products?.name ?? "Furnishing item",planned_quantity:Number(s.quantity_override ?? s.resolved_quantity),existing_inventory_quantity:Number(s.existing_quantity ?? 0),estimated_unit_cost_minor:s.estimated_unit_price_minor,estimated_line_cost_minor:s.estimated_total_minor,currency:s.currency,source_snapshot:{selectionStatus:s.selection_status,priority:s.priority,quantityRuleId:s.quantity_rule_id,overrideReason:s.quantity_override_reason,styleCompatibility:s.style_compatibility}}));
  const inserted = rows.length ? await db.from("furnishing_procurement_lines").insert(rows) : { error: null };
  if (inserted.error) { await db.from("furnishing_procurement_baselines").delete().eq("id", baseline.id); throw new Error("FS006_BASELINE_LINES_FAILED"); }
  await db.from("furnishing_procurement_events").insert({baseline_id:baseline.id,workspace_id:project.workspace_id,property_id:project.property_id,project_id:project.id,actor_id:actorId,correlation_id:crypto.randomUUID(),event_type:"procurement_baseline_generated",resulting_version:1,policy_version:"fs006-v1",related_type:"plan",related_id:plan.id,payload:{sourcePlanVersion:plan.version_number,lineCount:rows.length}});
  revalidatePath(`/dashboard/furnishing/projects/${projectId}/procurement`); revalidatePath(`/admin/furnishing/projects/${projectId}/procurement`);
  return { id: baseline.id, alreadyGenerated: false };
}
export async function changeProcurementLineOfferAction(formData: FormData) {
  const projectId = text(formData, "projectId"), lineId = text(formData, "lineId"), offerId = text(formData, "offerId");
  const { db } = await scope(projectId, true);
  const { data: line } = await db.from("furnishing_procurement_lines").select("id,product_id,procurement_quantity").eq("id", lineId).single();
  if (!line) throw new Error("FS006_LINE_NOT_FOUND");
  const { data: offer } = await db.from("furnishing_product_offers").select("id,listed_price_minor,product_id").eq("id", offerId).eq("product_id", line.product_id).single();
  if (!offer) throw new Error("FS006_OFFER_INVALID");
  const unit = offer.listed_price_minor;
  const { error } = await db.from("furnishing_procurement_lines").update({
    selected_offer_id: offer.id,
    estimated_unit_cost_minor: unit,
    estimated_line_cost_minor: unit === null ? null : Math.round(Number(unit) * Number(line.procurement_quantity)),
  }).eq("id", lineId);
  if (error) throw new Error("FURNISHING_OPERATION_FAILED");
  revalidatePath(`/dashboard/furnishing/projects/${projectId}/procurement`); revalidatePath(`/admin/furnishing/projects/${projectId}/procurement`);
}
export async function submitPurchaseBatchAction(formData: FormData) {
  const projectId = text(formData, "projectId"), baselineId = text(formData, "baselineId"), retailerId = text(formData, "retailerId"), idempotencyKey = text(formData, "idempotencyKey") || crypto.randomUUID();
  const { db, project, actorId } = await scope(projectId, true);
  const { data: budget } = await db.from("furnishing_project_procurement_budgets").select("id").eq("baseline_id", baselineId).order("version", { ascending: false }).limit(1).maybeSingle();
  if (!budget) throw new Error("FS006_BUDGET_REQUIRED");
  const { data: lines } = await db.from("furnishing_procurement_lines").select("id,estimated_unit_cost_minor,estimated_line_cost_minor,procurement_quantity,currency,selected_offer_id,furnishing_product_offers(retailer_id,listed_price_minor,availability)").eq("baseline_id", baselineId).in("status", ["planned", "ready"]).not("selected_offer_id", "is", null);
  const eligible = (lines ?? []).filter((l: Row) => l.furnishing_product_offers?.retailer_id === retailerId && l.furnishing_product_offers?.availability !== "out_of_stock");
  if (!eligible.length) throw new Error("FS006_NO_ELIGIBLE_LINES");
  const subtotal = eligible.reduce((sum: number, l: Row) => sum + Number(l.estimated_line_cost_minor ?? 0), 0);
  const currency = eligible[0].currency;
  const { data: batch, error } = await db.from("furnishing_purchase_batches").insert({
    baseline_id: baselineId, budget_id: budget.id, retailer_id: retailerId,
    delivery_destination: { address: project.properties?.address_line_1, city: project.properties?.city, state: project.properties?.state, postal_code: project.properties?.postal_code, country: project.properties?.country },
    status: "submitted", subtotal_minor: subtotal, total_minor: subtotal, currency,
    readiness_snapshot: { lineCount: eligible.length }, version: 1, idempotency_key: idempotencyKey,
    created_by: actorId, submitted_by: actorId, submitted_at: new Date().toISOString(),
  }).select("id").single();
  if (error || !batch) throw new Error("FS006_BATCH_CREATE_FAILED");
  const batchLines = eligible.map((l: Row) => ({
    batch_id: batch.id, line_id: l.id, quantity: l.procurement_quantity,
    confirmed_unit_price_minor: l.estimated_unit_cost_minor ?? 0,
    offer_confirmation: { offerId: l.selected_offer_id, listedPriceMinor: l.furnishing_product_offers?.listed_price_minor, availability: l.furnishing_product_offers?.availability },
  }));
  const { error: linesError } = await db.from("furnishing_purchase_batch_lines").insert(batchLines);
  if (linesError) { await db.from("furnishing_purchase_batches").delete().eq("id", batch.id); throw new Error("FS006_BATCH_LINES_FAILED"); }
  revalidatePath(`/dashboard/furnishing/projects/${projectId}/procurement`); revalidatePath(`/admin/furnishing/projects/${projectId}/procurement`);
}
export async function authorizePurchaseBatchAction(formData: FormData) {
  const projectId = text(formData, "projectId"), batchId = text(formData, "batchId");
  const { db, actorId } = await scope(projectId, true);
  const { data: batch } = await db.from("furnishing_purchase_batches").select("id,submitted_by,status").eq("id", batchId).single();
  if (!batch) throw new Error("FS006_BATCH_NOT_FOUND");
  if (batch.status !== "submitted") throw new Error("FS006_BATCH_NOT_SUBMITTED");
  if (batch.submitted_by === actorId) throw new Error("FS006_AUTHORIZATION_REQUIRES_DIFFERENT_ACTOR");
  const { error } = await db.from("furnishing_purchase_batches").update({ status: "authorized", authorized_by: actorId, authorized_at: new Date().toISOString() }).eq("id", batchId);
  if (error) throw new Error("FURNISHING_OPERATION_FAILED");
  const { data: batchLines } = await db.from("furnishing_purchase_batch_lines").select("line_id").eq("batch_id", batchId);
  const lineIds = (batchLines ?? []).map((x: Row) => x.line_id);
  if (lineIds.length) await db.from("furnishing_procurement_lines").update({ status: "authorized" }).in("id", lineIds);
  revalidatePath(`/dashboard/furnishing/projects/${projectId}/procurement`); revalidatePath(`/admin/furnishing/projects/${projectId}/procurement`);
}
export async function recordExternalOrderAction(formData: FormData) {
  const projectId = text(formData, "projectId"), batchId = text(formData, "batchId"), externalOrderId = text(formData, "externalOrderId"), orderDate = text(formData, "orderDate");
  if (!externalOrderId) throw new Error("FS006_EXTERNAL_ORDER_ID_REQUIRED");
  const { db, project } = await scope(projectId, true);
  const { data: batch } = await db.from("furnishing_purchase_batches").select("*,furnishing_retailers(name)").eq("id", batchId).single();
  if (!batch) throw new Error("FS006_BATCH_NOT_FOUND");
  if (batch.status !== "authorized") throw new Error("FS006_BATCH_NOT_AUTHORIZED");
  const { data: batchLines } = await db.from("furnishing_purchase_batch_lines").select("*,furnishing_procurement_lines(id,currency)").eq("batch_id", batchId);
  const poNumber = `EXT-${Date.now()}`;
  const { data: order, error } = await db.from("furnishing_procurement_orders").insert({
    project_id: projectId, baseline_id: batch.baseline_id, batch_id: batch.id, workspace_id: project.workspace_id, retailer_id: batch.retailer_id,
    po_number: poNumber, vendor: batch.furnishing_retailers?.name ?? "Retailer", order_type: "external",
    external_order_id: externalOrderId, status: "ordered", total: batch.total_minor / 100,
    order_date: orderDate || new Date().toISOString().slice(0, 10),
    authorized_total_minor: batch.total_minor, actual_total_minor: batch.total_minor,
  }).select("id").single();
  if (error || !order) throw new Error("FS006_ORDER_CREATE_FAILED");
  const orderLines = (batchLines ?? []).map((bl: Row) => ({
    order_id: order.id, procurement_line_id: bl.line_id, snapshot: bl.offer_confirmation,
    ordered_quantity: bl.quantity, unit_price_minor: bl.confirmed_unit_price_minor,
    line_total_minor: Math.round(Number(bl.confirmed_unit_price_minor) * Number(bl.quantity)),
    currency: bl.furnishing_procurement_lines?.currency ?? "USD",
  }));
  if (orderLines.length) {
    const { error: olError } = await db.from("furnishing_procurement_order_lines").insert(orderLines);
    if (olError) throw new Error("FS006_ORDER_LINES_FAILED");
  }
  await db.from("furnishing_purchase_batches").update({ status: "ordered" }).eq("id", batchId);
  const lineIds = (batchLines ?? []).map((x: Row) => x.line_id);
  if (lineIds.length) await db.from("furnishing_procurement_lines").update({ status: "ordered" }).in("id", lineIds);
  revalidatePath(`/dashboard/furnishing/projects/${projectId}/procurement`); revalidatePath(`/admin/furnishing/projects/${projectId}/procurement`);
}
export async function recordReceivingAction(formData: FormData) {
  const projectId = text(formData, "projectId"), lineId = text(formData, "lineId"),
    receivedQuantity = Number(text(formData, "receivedQuantity")), acceptedQuantity = Number(text(formData, "acceptedQuantity")),
    condition = text(formData, "condition");
  if (!Number.isFinite(receivedQuantity) || receivedQuantity < 0 || !Number.isFinite(acceptedQuantity) || acceptedQuantity < 0 || acceptedQuantity > receivedQuantity) throw new Error("FS006_RECEIVING_QUANTITY_INVALID");
  const { db } = await scope(projectId, true);
  const { data: line } = await db.from("furnishing_procurement_lines").select("id,baseline_id,procurement_quantity,status").eq("id", lineId).single();
  if (!line) throw new Error("FS006_LINE_NOT_FOUND");
  const required = Number(line.procurement_quantity);
  const status = acceptedQuantity >= required ? "fulfilled" : acceptedQuantity > 0 ? "partially_fulfilled" : line.status;
  const { error } = await db.from("furnishing_procurement_lines").update({
    received_quantity: receivedQuantity, accepted_quantity: acceptedQuantity, status,
  }).eq("id", lineId);
  if (error) throw new Error("FURNISHING_OPERATION_FAILED");
  if (receivedQuantity > acceptedQuantity || condition !== "good") {
    await db.from("furnishing_procurement_exceptions").insert({
      baseline_id: line.baseline_id, line_id: lineId,
      exception_type: condition !== "good" ? "damaged" : "shortage",
      severity: condition !== "good" ? "blocking" : "warning",
      detail: { receivedQuantity, acceptedQuantity, condition },
    });
  }
  revalidatePath(`/dashboard/furnishing/projects/${projectId}/procurement`); revalidatePath(`/admin/furnishing/projects/${projectId}/procurement`);
}
export async function saveProcurementBudgetAction(formData: FormData) {
  const projectId=text(formData,"projectId"), baselineId=text(formData,"baselineId"), base=Math.round(Number(text(formData,"baseAmount"))*100), contingency=Math.round(Number(text(formData,"contingency"))*100);
  if(!Number.isSafeInteger(base)||base<0||!Number.isSafeInteger(contingency)||contingency<0) throw new Error("FS006_BUDGET_INVALID");
  const {db,project,actorId}=await scope(projectId,true);
  const {data:latest}=await db.from("furnishing_project_procurement_budgets").select("version").eq("baseline_id",baselineId).order("version",{ascending:false}).limit(1).maybeSingle();
  const {error}=await db.from("furnishing_project_procurement_budgets").insert({baseline_id:baselineId,workspace_id:project.workspace_id,property_id:project.property_id,project_id:project.id,currency:"USD",status:"submitted",base_amount_minor:base,contingency_minor:contingency,forecast_final_minor:base,version:Number(latest?.version??0)+1,submitted_by:actorId,submitted_at:new Date().toISOString(),created_by:actorId});
  if(error) throw new Error("FURNISHING_OPERATION_FAILED"); revalidatePath(`/dashboard/furnishing/projects/${projectId}/procurement`); revalidatePath(`/admin/furnishing/projects/${projectId}/procurement`);
}
