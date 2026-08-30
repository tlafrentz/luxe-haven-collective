"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const value = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const command = () => ({
  correlation_id: crypto.randomUUID(),
  idempotency_key: crypto.randomUUID(),
});
const rpcError = (error: { message?: string } | null) =>
  error?.message?.match(/ROOM_PACKAGE_[A-Z_]+/)?.[0] ?? "ROOM_PACKAGE_PERSISTENCE_FAILED";

async function adminContext() {
  await requireRole(["admin"]);
  return createAdminClient();
}

export async function getFsux4Workspace() {
  const db = await adminContext();
  const { data } = await db
    .from("furnishing_activation_workspaces")
    .select("workspace_id,owners(id,display_name)")
    .eq("enabled", true)
    .eq("cohort", "internal")
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.workspace_id ? String(data.workspace_id) : null;
}

export async function getFsux4PackageLibrary() {
  const db = await adminContext();
  const workspaceId = await getFsux4Workspace();
  const { data, error } = await db
    .from("furnishing_packages")
    .select("id,name,description,property_type,style,governance_scope,workspace_id,lifecycle_status,current_version_id,source_template_id,updated_at,furnishing_package_versions!furnishing_package_versions_furnishing_package_id_fkey(id,version_number,lifecycle_status,guest_max,bedroom_max,bathroom_max,estimated_budget_low_minor,estimated_budget_high_minor,currency,optimistic_version,fsux4_package_rooms(id),fsux4_package_items(id,quantity,unit_price_minor,budget_treatment))")
    .neq("governance_scope", "legacy_ambiguous")
    .or(`governance_scope.eq.platform,workspace_id.eq.${workspaceId}`)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return { packages: data ?? [], workspaceId };
}

export async function getFsux4Package(packageId: string) {
  const db = await adminContext();
  const [{ data: pkg, error }, { data: products }] = await Promise.all([
    db
      .from("furnishing_packages")
      .select("*,furnishing_package_versions!furnishing_package_versions_furnishing_package_id_fkey(*,fsux4_package_rooms(*),fsux4_package_items(*,furnishing_products(id,name,scope,workspace_id,status,revision,category,brand),fsux4_package_item_alternatives(*,furnishing_products(id,name,status,revision))),fsux4_package_validation_runs(*)),fsux4_package_review_events(*),fsux4_package_approval_snapshots(id,package_version_id,snapshot_hash,approved_at)")
      .eq("id", packageId)
      .neq("governance_scope", "legacy_ambiguous")
      .single(),
    db
      .from("furnishing_products")
      .select("id,name,scope,workspace_id,status,revision,category,brand,furnishing_product_offers(listed_price_minor,currency,last_verified_at)")
      .eq("status", "approved")
      .order("name")
      .limit(250),
  ]);
  if (error || !pkg) throw new Error("ROOM_PACKAGE_NOT_FOUND_OR_FROZEN");
  return { pkg, products: (products ?? []).filter((product) => pkg.governance_scope === "platform" ? product.scope === "platform" : product.scope === "workspace" && product.workspace_id === pkg.workspace_id) };
}

export async function getFsux4LegacyPackages() {
  const db = await adminContext();
  const { data, error } = await db
    .from("furnishing_packages")
    .select("id,name,created_at,workspace_id,governance_scope,lifecycle_status,current_version_id")
    .eq("governance_scope", "legacy_ambiguous")
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createFsux4PackageAction(formData: FormData) {
  await requireRole(["admin"]);
  const scope = value(formData, "scope") || "workspace";
  const workspaceId = scope === "workspace" ? await getFsux4Workspace() : null;
  const db = await createClient();
  const { data, error } = await db.rpc("fsux4_create_package", {
    p_input: {
      ...command(),
      scope,
      workspace_id: workspaceId,
      name: value(formData, "name"),
      description: value(formData, "description"),
      property_type: value(formData, "propertyType"),
      design_direction: value(formData, "designDirection"),
      quality_tier: value(formData, "qualityTier"),
      bedrooms: value(formData, "bedrooms"),
      bathrooms: value(formData, "bathrooms"),
      maximum_guests: value(formData, "maximumGuests"),
      currency: value(formData, "currency") || "USD",
      target_min_minor: String(Math.round(Number(value(formData, "targetMin") || 0) * 100)),
      target_max_minor: String(Math.round(Number(value(formData, "targetMax") || 0) * 100)),
      budget_basis: value(formData, "budgetBasis"),
      profile: { includedSpaces: formData.getAll("includedSpaces") },
    },
  });
  if (error) throw new Error(rpcError(error));
  redirect(`/admin/furnishing/room-packages/${String((data as { packageId: string }).packageId)}/edit`);
}

async function packageMutation(formData: FormData, operation: string) {
  await requireRole(["admin"]);
  const packageId = value(formData, "packageId");
  const db = await createClient();
  const { error } = await db.rpc("fsux4_mutate_package", {
    p_input: {
      ...command(),
      operation,
      package_id: packageId,
      package_version_id: value(formData, "versionId"),
      expected_version: Number(value(formData, "expectedVersion")),
      room_id: value(formData, "roomId") || undefined,
      canonical_room_type: value(formData, "roomType"),
      display_name: value(formData, "displayName"),
      is_required: value(formData, "isRequired") !== "false",
      intended_occupancy: Number(value(formData, "occupancy") || 0),
      sleeping_capacity: Number(value(formData, "sleepingCapacity") || 0),
      description: value(formData, "description"),
      product_id: value(formData, "productId"),
      item_id: value(formData, "itemId") || undefined,
      quantity: Number(value(formData, "quantity") || 1),
      priority: value(formData, "priority"),
      fulfillment_required: value(formData, "fulfillmentRequired") !== "false",
      placement_guidance: value(formData, "placementGuidance"),
      item_kind: value(formData, "itemKind") || "other",
      unit_price_minor: value(formData, "unitPriceMinor"),
      currency: value(formData, "currency") || "USD",
      reason: value(formData, "reason"),
    },
  });
  if (error) throw new Error(rpcError(error));
  revalidatePath(`/admin/furnishing/room-packages/${packageId}`);
  revalidatePath(`/admin/furnishing/room-packages/${packageId}/edit`);
}

export async function addFsux4RoomAction(formData: FormData) {
  return packageMutation(formData, "add_room");
}
export async function addFsux4ItemAction(formData: FormData) {
  return packageMutation(formData, "add_item");
}
export async function addFsux4AlternativeAction(formData: FormData) {
  return packageMutation(formData, "add_alternative");
}

export async function validateFsux4PackageAction(formData: FormData) {
  await requireRole(["admin"]);
  const packageId = value(formData, "packageId");
  const db = await createClient();
  const { error } = await db.rpc("fsux4_validate_package", {
    p_input: {
      ...command(),
      package_id: packageId,
      package_version_id: value(formData, "versionId"),
      expected_version: Number(value(formData, "expectedVersion")),
    },
  });
  if (error) throw new Error(rpcError(error));
  revalidatePath(`/admin/furnishing/room-packages/${packageId}/validation`);
  redirect(`/admin/furnishing/room-packages/${packageId}/validation`);
}

export async function submitFsux4PackageAction(formData: FormData) {
  await requireRole(["admin"]);
  const packageId = value(formData, "packageId");
  const db = await createClient();
  const validation = await db.rpc("fsux4_validate_package", {
    p_input: {
      ...command(),
      package_id: packageId,
      package_version_id: value(formData, "versionId"),
      expected_version: Number(value(formData, "expectedVersion")),
    },
  });
  if (validation.error) throw new Error(rpcError(validation.error));
  const result = validation.data as { status: string; validationRunId: string };
  if (result.status !== "ready") throw new Error("ROOM_PACKAGE_VALIDATION_BLOCKED");
  const { error } = await db.rpc("fsux4_submit_package_review", {
    p_input: {
      ...command(),
      package_id: packageId,
      package_version_id: value(formData, "versionId"),
      expected_version: Number(value(formData, "expectedVersion")),
      validation_run_id: result.validationRunId,
    },
  });
  if (error) throw new Error(rpcError(error));
  redirect(`/admin/furnishing/room-packages/${packageId}/review`);
}

export async function reviewFsux4PackageAction(formData: FormData) {
  await requireRole(["admin"]);
  const packageId = value(formData, "packageId");
  const db = await createClient();
  const { error } = await db.rpc("fsux4_review_package", {
    p_input: {
      ...command(),
      package_id: packageId,
      package_version_id: value(formData, "versionId"),
      expected_version: Number(value(formData, "expectedVersion")),
      decision: value(formData, "decision"),
      reason: value(formData, "reason"),
      affected_target: {},
    },
  });
  if (error) throw new Error(rpcError(error));
  revalidatePath(`/admin/furnishing/room-packages/${packageId}`);
  redirect(`/admin/furnishing/room-packages/${packageId}`);
}

export async function reviseFsux4PackageAction(formData: FormData) {
  await requireRole(["admin"]);
  const packageId = value(formData, "packageId");
  const db = await createClient();
  const { error } = await db.rpc("fsux4_create_package_revision", {
    p_input: {
      ...command(),
      package_id: packageId,
      source_version_id: value(formData, "versionId"),
      expected_version: Number(value(formData, "expectedVersion")),
      reason: value(formData, "reason") || "Package revision",
    },
  });
  if (error) throw new Error(rpcError(error));
  redirect(`/admin/furnishing/room-packages/${packageId}/edit`);
}

export async function retireFsux4PackageAction(formData: FormData) {
  await requireRole(["admin"]);
  const packageId = value(formData, "packageId");
  const db = await createClient();
  const { error } = await db.rpc("fsux4_retire_package", {
    p_input: {
      ...command(),
      package_id: packageId,
      expected_version: Number(value(formData, "expectedVersion")),
      reason: value(formData, "reason"),
      replacement_package_id: value(formData, "replacementPackageId"),
    },
  });
  if (error) throw new Error(rpcError(error));
  redirect(`/admin/furnishing/room-packages/${packageId}`);
}

export async function adoptFsux4TemplateAction(formData: FormData) {
  await requireRole(["admin"]);
  const workspaceId = await getFsux4Workspace();
  const db = await createClient();
  const { data, error } = await db.rpc("fsux4_adopt_template", {
    p_input: {
      ...command(),
      workspace_id: workspaceId,
      source_template_id: value(formData, "packageId"),
      source_version_id: value(formData, "versionId"),
      product_mapping: {},
      workspace_overrides: {},
    },
  });
  if (error) throw new Error(rpcError(error));
  redirect(`/admin/furnishing/room-packages/${String((data as { packageId: string }).packageId)}/edit`);
}
