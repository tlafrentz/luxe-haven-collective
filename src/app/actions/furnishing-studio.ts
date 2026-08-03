"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PROJECT_PHASES,
  PROJECT_STATUSES,
  projectProgress,
  snapshotPackage,
} from "@/features/furnishing-studio";

async function admin() {
  const { user } = await requireRole(["admin"]);
  return { user, db: createAdminClient() };
}
export async function getFurnishingStudio() {
  const { db } = await admin();
  const [
    packages,
    variants,
    rooms,
    items,
    products,
    projects,
    orders,
    installations,
    punch,
    activity,
    properties,
  ] = await Promise.all([
    db
      .from("furnishing_packages")
      .select("*")
      .order("updated_at", { ascending: false }),
    db.from("furnishing_package_variants").select("*").order("name"),
    db.from("furnishing_package_rooms").select("*").order("position"),
    db.from("furnishing_package_items").select("*").order("position"),
    db.from("furnishing_product_options").select("*").is("archived_at", null),
    db
      .from("furnishing_projects")
      .select("*,properties(id,name,featured_image)")
      .order("updated_at", { ascending: false }),
    db
      .from("furnishing_procurement_orders")
      .select("*,furnishing_projects(id,name)")
      .order("updated_at", { ascending: false }),
    db
      .from("furnishing_installation_tasks")
      .select("*,furnishing_projects(id,name)")
      .order("scheduled_at"),
    db
      .from("furnishing_punch_list_items")
      .select("*")
      .order("created_at", { ascending: false }),
    db
      .from("furnishing_activity")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(50),
    db.from("properties").select("id,name,featured_image").order("name"),
  ]);
  const error = [
    packages,
    variants,
    rooms,
    items,
    products,
    projects,
    orders,
    installations,
    punch,
    activity,
    properties,
  ].find((x) => x.error)?.error;
  return {
    ok: !error,
    error: error?.message,
    packages: packages.data ?? [],
    variants: variants.data ?? [],
    rooms: rooms.data ?? [],
    items: items.data ?? [],
    products: products.data ?? [],
    projects: projects.data ?? [],
    orders: orders.data ?? [],
    installations: installations.data ?? [],
    punch: punch.data ?? [],
    activity: activity.data ?? [],
    properties: properties.data ?? [],
  };
}
export async function createFurnishingProjectAction(formData: FormData) {
  const { db, user } = await admin();
  const propertyId = String(formData.get("propertyId") ?? ""),
    name = String(formData.get("name") ?? "").trim(),
    packageId = String(formData.get("packageId") ?? "") || null,
    variantId = String(formData.get("variantId") ?? "") || null;
  if (!propertyId || !name) throw new Error("property_and_name_required");
  let packageSnapshot: Record<string, unknown> = {
    type: "custom",
    capturedAt: new Date().toISOString(),
  };
  if (packageId) {
    const [{ data: pkg }, { data: variant }, { data: rooms }] =
      await Promise.all([
        db.from("furnishing_packages").select("*").eq("id", packageId).single(),
        db
          .from("furnishing_package_variants")
          .select("*")
          .eq("id", variantId)
          .eq("package_id", packageId)
          .single(),
        db
          .from("furnishing_package_rooms")
          .select("*,furnishing_package_items(*,furnishing_product_options(*))")
          .eq("variant_id", variantId)
          .order("position"),
      ]);
    if (!pkg || !variant) throw new Error("package_variant_required");
    packageSnapshot = snapshotPackage({
      type: "package",
      package: pkg,
      variant,
      rooms: rooms ?? [],
      capturedAt: new Date().toISOString(),
    });
  }
  const budget = {
    target: Number(formData.get("targetBudget")) || 0,
    contingency: Number(formData.get("contingency")) || 0,
    labor: Number(formData.get("labor")) || 0,
    delivery: Number(formData.get("delivery")) || 0,
    installation: Number(formData.get("installation")) || 0,
    tax: Number(formData.get("tax")) || 0,
  };
  const scope = formData.getAll("scope").map(String);
  const snapshotRooms = Array.isArray(packageSnapshot.rooms)
    ? (packageSnapshot.rooms as Record<string, unknown>[])
    : [];
  const snapshotSelections = snapshotRooms.flatMap((room) =>
    (Array.isArray(room.furnishing_package_items)
      ? (room.furnishing_package_items as Record<string, unknown>[])
      : []
    ).map((item) => ({
      packageItemId: item.id,
      room: room.name,
      itemName: item.name,
      category: item.category,
      required: Boolean(item.required),
      quantity: Number(item.quantity) || 1,
      selectionStatus: "not_selected",
      procurementStatus: "not_ordered",
      product: null,
    })),
  );
  const { data, error } = await db
    .from("furnishing_projects")
    .insert({
      property_id: propertyId,
      name,
      owner_name: String(formData.get("owner") ?? ""),
      project_lead: String(formData.get("lead") ?? ""),
      target_install_date: String(formData.get("targetDate") ?? "") || null,
      status: "planned",
      phase: "setup",
      package_id: packageId,
      variant_id: variantId,
      package_snapshot: packageSnapshot,
      scope,
      budget,
      selections: snapshotSelections,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  await Promise.all([
    db.from("furnishing_activity").insert({
      project_id: data.id,
      event_type: "project_created",
      summary: `Project ${name} created with ${snapshotSelections.length} checklist items`,
      actor_id: user.id,
    }),
    snapshotSelections.length
      ? db.from("furnishing_installation_tasks").insert(
          snapshotSelections.map((selection) => ({
            project_id: data.id,
            room: String(selection.room),
            item_name: String(selection.itemName),
            quantity_expected: Number(selection.quantity),
            status: "pending",
          })),
        )
      : Promise.resolve({ error: null }),
  ]);
  revalidatePath("/admin/furnishing");
  redirect(`/admin/furnishing/projects/${data.id}`);
}
export async function createFurnishingPackageAction(formData: FormData) {
  const { db } = await admin();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("package_name_required");
  const { data, error } = await db
    .from("furnishing_packages")
    .insert({
      name,
      description: String(formData.get("description") ?? ""),
      property_type: String(formData.get("propertyType") ?? "custom"),
      style: String(formData.get("style") ?? "custom"),
      budget_tier: String(formData.get("budgetTier") ?? "standard"),
      starting_budget: Number(formData.get("budget")) || 0,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { data: variant, error: variantError } = await db
    .from("furnishing_package_variants")
    .insert({
      package_id: data.id,
      name: String(formData.get("variant") ?? "Custom"),
      estimated_budget: Number(formData.get("budget")) || 0,
    })
    .select("id")
    .single();
  if (variantError) throw new Error(variantError.message);
  revalidatePath("/admin/furnishing/packages");
  redirect(`/admin/furnishing/packages/${data.id}/variants/${variant.id}`);
}
export async function updateFurnishingProjectAction(formData: FormData) {
  const { db, user } = await admin();
  const id = String(formData.get("projectId")),
    status = String(formData.get("status")),
    phase = String(formData.get("phase"));
  if (
    !PROJECT_STATUSES.includes(status as never) ||
    !PROJECT_PHASES.includes(phase as never)
  )
    throw new Error("invalid_project_state");
  const { data: open } = await db
    .from("furnishing_punch_list_items")
    .select("id")
    .eq("project_id", id)
    .neq("status", "resolved");
  if (
    phase === "complete" &&
    (open?.length ?? 0) > 0 &&
    !formData.get("authorizeException")
  )
    throw new Error("open_punch_list_blocks_completion");
  const { error } = await db
    .from("furnishing_projects")
    .update({
      status,
      phase,
      progress: projectProgress(phase as never),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await db.from("furnishing_activity").insert({
    project_id: id,
    event_type: "project_state_changed",
    summary: `Project moved to ${phase.replaceAll("_", " ")} (${status.replaceAll("_", " ")})`,
    actor_id: user.id,
  });
  revalidatePath(`/admin/furnishing/projects/${id}`);
}
export async function createProcurementOrderAction(formData: FormData) {
  const { db, user } = await admin();
  const projectId = String(formData.get("projectId")),
    vendor = String(formData.get("vendor") ?? "").trim();
  if (!projectId || !vendor) throw new Error("project_and_vendor_required");
  const po = `PO-${Date.now().toString().slice(-7)}`;
  const { error } = await db.from("furnishing_procurement_orders").insert({
    project_id: projectId,
    po_number: po,
    vendor,
    total: Number(formData.get("total")) || 0,
    status: "ready_to_order",
    estimated_delivery: String(formData.get("deliveryDate") ?? "") || null,
  });
  if (error) throw new Error(error.message);
  await db.from("furnishing_activity").insert({
    project_id: projectId,
    event_type: "order_created",
    summary: `${po} created for ${vendor}`,
    actor_id: user.id,
  });
  revalidatePath("/admin/furnishing/procurement");
}
export async function updateOrderStatusAction(formData: FormData) {
  const { db } = await admin();
  const id = String(formData.get("orderId")),
    status = String(formData.get("status"));
  const { error } = await db
    .from("furnishing_procurement_orders")
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...(status === "delivered"
        ? { actual_delivery: new Date().toISOString().slice(0, 10) }
        : {}),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/furnishing/procurement");
}
export async function updateInstallationStatusAction(formData: FormData) {
  const { db } = await admin();
  const id = String(formData.get("installationId")),
    status = String(formData.get("status"));
  const { error } = await db
    .from("furnishing_installation_tasks")
    .update({
      status,
      quantity_installed: status === "installed" ? 1 : 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/furnishing/installation");
}
