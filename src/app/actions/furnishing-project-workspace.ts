"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertFurnishingEntitlement } from "./furnishing-access";
import {
  minorUnits,
  representativeOffer,
  resolveQuantity,
  validatePlan,
} from "@/features/furnishing-studio";
// Supabase projections are dynamic until the pending FS migrations generate database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const value = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
async function context() {
  const { user, profile } = await requireUser();
  return { user, profile, db: createAdminClient() };
}
async function authorize(
  db: ReturnType<typeof createAdminClient>,
  profile: Row | null | undefined,
  workspaceId: string,
  write = true,
) {
  if (profile?.role === "admin") return;
  let query = db
    .from("workspace_memberships")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("profile_id", profile?.id)
    .eq("status", "active");
  if (write)
    query = query.in("role", [
      "owner",
      "administrator",
      "operator",
      "contributor",
    ]);
  const { data } = await query.maybeSingle();
  if (!data) throw new Error("FURNISHING_PROJECT_ACCESS_DENIED");
  await assertFurnishingEntitlement(workspaceId);
}
export async function getProjectSetup() {
  const { db, profile } = await context();
  const { data: workspaceRows } =
    profile?.role === "admin"
      ? await db
          .from("owners")
          .select("id,profiles(full_name,email)")
          .limit(100)
      : await db
          .from("workspace_memberships")
          .select("workspace_id,role")
          .eq("profile_id", profile?.id)
          .eq("status", "active")
          .order("created_at", { ascending: true })
          .limit(1);
  if (profile?.role !== "admin") {
    const workspaceId = (workspaceRows?.[0] as Row | undefined)?.workspace_id;
    if (!workspaceId) throw new Error("FURNISHING_PROJECT_ACCESS_DENIED");
    await authorize(db, profile, String(workspaceId), false);
  }
  let properties = db
    .from("properties")
    .select(
      "id,name,owner_id,address_line_1,city,state,bedrooms,bathrooms,max_guests,property_type",
    )
    .order("name");
  if (profile?.role !== "admin") {
    const workspaceId = (workspaceRows?.[0] as Row | undefined)?.workspace_id;
    properties = properties.eq("owner_id", workspaceId);
  }
  const [propertyRows, packages, styles] = await Promise.all([
    properties,
    db
      .from("furnishing_package_versions")
      .select(
        "id,version_number,estimated_budget_low_minor,estimated_budget_high_minor,bedroom_min,bedroom_max,bathroom_min,bathroom_max,guest_min,guest_max,furnishing_packages!furnishing_package_versions_furnishing_package_id_fkey(id,name,description,tier,property_type)",
      )
      .eq("lifecycle_status", "approved"),
    db
      .from("furnishing_style_system_versions")
      .select(
        "id,version_number,mood_tags,contextual_tags,furnishing_style_systems!furnishing_style_system_versions_style_system_id_fkey(id,name,description)",
      )
      .eq("lifecycle_status", "approved"),
  ]);
  const error = [propertyRows, packages, styles].find((x) => x.error)?.error;
  if (error) throw new Error("FURNISHING_OPERATION_FAILED");
  return {
    properties: propertyRows.data ?? [],
    packages: packages.data ?? [],
    styles: styles.data ?? [],
    workspaces: workspaceRows ?? [],
  };
}
export async function listProjectWorkspaces() {
  const { profile, db } = await context();
  let query = db
    .from("furnishing_projects")
    .select(
      "id,name,project_type,lifecycle_status,plan_status,target_budget_minor,target_launch_date,updated_at,properties(name,city,state),furnishing_plans!furnishing_plans_project_id_fkey(id,version_number,status,estimated_total_minor)",
    )
    .order("updated_at", { ascending: false });
  if (profile?.role !== "admin") {
    const { data: members } = await db
      .from("workspace_memberships")
      .select("workspace_id")
      .eq("profile_id", profile?.id)
      .eq("status", "active")
      .order("created_at", { ascending: true })
      .limit(1);
    const workspaceId = members?.[0]?.workspace_id;
    if (!workspaceId) throw new Error("FURNISHING_PROJECT_ACCESS_DENIED");
    await authorize(db, profile, String(workspaceId), false);
    query = query.eq("workspace_id", workspaceId);
  }
  const { data, error } = await query;
  if (error) throw new Error("FURNISHING_OPERATION_FAILED");
  return data ?? [];
}
const suggestedRooms = (bedrooms: number, bathrooms: number) => [
  { name: "Living Room", room_type: "living_room", ordinal: null },
  { name: "Primary Bedroom", room_type: "primary_bedroom", ordinal: 1 },
  ...Array.from({ length: Math.max(0, bedrooms - 1) }, (_, i) => ({
    name: `Bedroom ${i + 2}`,
    room_type: "bedroom",
    ordinal: i + 2,
  })),
  ...Array.from({ length: bathrooms }, (_, i) => ({
    name: `Bathroom ${i + 1}`,
    room_type: "bathroom",
    ordinal: i + 1,
  })),
  { name: "Kitchen", room_type: "kitchen", ordinal: null },
  { name: "Dining Room", room_type: "dining_room", ordinal: null },
];
export async function createFurnishingPropertyAction(formData: FormData) {
  const { profile, db } = await context(),
    workspaceId = value(formData, "workspaceId");
  await authorize(db, profile, workspaceId);
  const name = value(formData, "propertyName"),
    address = value(formData, "address"),
    city = value(formData, "city"),
    state = value(formData, "state"),
    postalCode = value(formData, "postalCode"),
    timezone = value(formData, "timezone"),
    propertyType = value(formData, "propertyType");
  if (
    [name, address, city, state, postalCode, timezone, propertyType].some(
      (x) => !x,
    )
  )
    throw new Error("PROPERTY_REQUIRED_FIELDS_MISSING");
  const { data: duplicate } = await db
    .from("properties")
    .select("id")
    .eq("owner_id", workspaceId)
    .ilike("address_line_1", address)
    .eq("postal_code", postalCode)
    .maybeSingle();
  if (duplicate && formData.get("createAnyway") !== "on")
    throw new Error("POTENTIAL_DUPLICATE_PROPERTY");
  const slug = `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 8)}`;
  const { data: property, error } = await db
    .from("properties")
    .insert({
      owner_id: workspaceId,
      name,
      slug,
      description: "",
      address_line_1: address,
      city,
      state,
      postal_code: postalCode,
      country: value(formData, "country") || "US",
      property_type: propertyType,
      timezone,
      bedrooms: Number(formData.get("propertyBedrooms")) || 1,
      bathrooms: Number(formData.get("propertyBathrooms")) || 1,
      max_guests: Number(formData.get("propertyGuests")) || 2,
      status: "draft",
      source: "manual",
    })
    .select("id")
    .single();
  if (error) throw new Error("FURNISHING_OPERATION_FAILED");
  const prefix = profile?.role === "admin" ? "/admin" : "/dashboard";
  redirect(`${prefix}/furnishing/projects/new?property=${property.id}`);
}
export async function createProjectWorkspaceAction(formData: FormData) {
  const { user, profile, db } = await context(),
    propertyId = value(formData, "propertyId");
  const { data: property } = await db
    .from("properties")
    .select("id,owner_id,bedrooms,bathrooms,max_guests,property_type")
    .eq("id", propertyId)
    .single();
  if (!property) throw new Error("PROPERTY_REQUIRED");
  await authorize(db, profile, property.owner_id);
  const target = value(formData, "targetBudget"),
    packageVersionId = value(formData, "packageVersionId"),
    styleVersionId = value(formData, "styleVersionId");
  const { data: project, error } = await db
    .from("furnishing_projects")
    .insert({
      workspace_id: property.owner_id,
      property_id: property.id,
      name: value(formData, "name"),
      description: value(formData, "notes") || null,
      lifecycle_status: "planning",
      project_type: value(formData, "projectType"),
      target_budget_minor: target ? minorUnits(target).amountMinor : null,
      target_launch_date: value(formData, "targetLaunchDate") || null,
      furnishing_package_version_id: packageVersionId,
      design_profile_version_id: null,
      budget_priority: value(formData, "budgetPriority"),
      plan_status: "not_generated",
      created_by: user.id,
      status: "draft",
      phase: "setup",
      budget: { target: Number(target) || 0 },
    })
    .select("id")
    .single();
  if (error) throw new Error("FURNISHING_OPERATION_FAILED");
  const bedrooms =
      Number(formData.get("bedrooms")) || Number(property.bedrooms) || 1,
    bathrooms = Math.ceil(
      Number(formData.get("bathrooms")) || Number(property.bathrooms) || 1,
    ),
    guests = Number(formData.get("guests")) || Number(property.max_guests) || 2;
  await db.from("property_furnishing_profiles").upsert(
    {
      property_id: property.id,
      bedroom_count: bedrooms,
      bathroom_count: bathrooms,
      guest_capacity: guests,
      property_type: property.property_type,
      furnishing_state: value(formData, "furnishingState") || "unknown",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "property_id" },
  );
  const rooms = suggestedRooms(bedrooms, bathrooms);
  if (formData.get("includeOutdoor") === "on")
    rooms.push({ name: "Outdoor", room_type: "outdoor", ordinal: null });
  await db.from("furnishing_rooms").insert(
    rooms.map((room, index) => ({
      ...room,
      project_id: project.id,
      status: "not_started",
      sort_order: index,
    })),
  );
  if (styleVersionId) {
    const { data: style } = await db
      .from("furnishing_style_system_versions")
      .select(
        "*,furnishing_style_systems!furnishing_style_system_versions_style_system_id_fkey(name)",
      )
      .eq("id", styleVersionId)
      .single();
    const { data: profileRow, error: pe } = await db
      .from("furnishing_design_profiles")
      .insert({
        workspace_id: property.owner_id,
        property_id: property.id,
        project_id: project.id,
        name: `${value(formData, "name")} Design`,
        style_system_version_id: styleVersionId,
        status: "draft",
        created_by: user.id,
      })
      .select("id")
      .single();
    if (pe) throw new Error("FURNISHING_DESIGN_PROFILE_FAILED");
    const { data: profileVersion } = await db
      .from("furnishing_design_profile_versions")
      .insert({
        design_profile_id: profileRow.id,
        version_number: 1,
        style_system_version_id: styleVersionId,
        status: "draft",
        positioning_tier: value(formData, "tier"),
        mood_tags: style?.mood_tags ?? [],
        contextual_tags: style?.contextual_tags ?? [],
        created_by: user.id,
      })
      .select("id")
      .single();
    await db
      .from("furnishing_design_profiles")
      .update({ current_version_id: profileVersion?.id })
      .eq("id", profileRow.id);
    await db
      .from("furnishing_projects")
      .update({ design_profile_version_id: profileVersion?.id })
      .eq("id", project.id);
  }
  try {
    const planForm = new FormData();
    planForm.set("projectId", project.id);
    await generateFurnishingPlanAction(planForm);
  } catch {
    // Non-fatal: the customer can generate the plan manually from the
    // project page once an approved package version is available.
  }
  const prefix = profile?.role === "admin" ? "/admin" : "/dashboard";
  redirect(`${prefix}/furnishing/projects/${project.id}`);
}
export async function getProjectWorkspace(projectId: string) {
  const { profile, db } = await context();
  const { data: project, error } = await db
    .from("furnishing_projects")
    .select(
      "*,properties(*),furnishing_rooms!furnishing_rooms_project_id_fkey(*),furnishing_budgets(*),furnishing_plans!furnishing_plans_project_id_fkey(*,furnishing_product_selections(*,furnishing_products(*,furnishing_product_offers!furnishing_product_offers_product_id_fkey(*,furnishing_retailers(name))),furnishing_product_offers(*,furnishing_retailers(name)),furnishing_room_requirements(name,requirement_type),furnishing_existing_inventory(*))),furnishing_design_profile_versions(*,furnishing_style_system_versions(*,furnishing_style_systems!furnishing_style_system_versions_style_system_id_fkey(name),furnishing_product_style_assignments(*)))",
    )
    .eq("id", projectId)
    .single();
  if (error) throw new Error("FURNISHING_OPERATION_FAILED");
  await authorize(db, profile, project.workspace_id, false);
  const [
    { data: packages },
    { data: products },
    { data: notes },
    { data: validations },
    { data: propertyProfile },
    { data: moodBoards },
  ] = await Promise.all([
    db
      .from("furnishing_package_versions")
      .select(
        "*,furnishing_packages!furnishing_package_versions_furnishing_package_id_fkey(*),furnishing_package_room_composition(*,furnishing_room_package_versions(*,furnishing_room_packages!furnishing_room_package_versions_room_package_id_fkey(*),furnishing_room_package_items(*,furnishing_room_requirements(*),furnishing_quantity_rules(*),furnishing_products(*,furnishing_product_offers!furnishing_product_offers_product_id_fkey(*)))))",
      )
      .eq("id", project.furnishing_package_version_id)
      .maybeSingle(),
    db
      .from("furnishing_products")
      .select(
        "*,furnishing_product_offers!furnishing_product_offers_product_id_fkey(*,furnishing_retailers(name))",
      )
      .eq("status", "approved")
      .order("name")
      .limit(500),
    db
      .from("furnishing_project_notes")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
    db
      .from("furnishing_plan_validation_runs")
      .select("*")
      .in(
        "furnishing_plan_id",
        (project.furnishing_plans ?? []).map((x: Row) => x.id),
      )
      .order("created_at", { ascending: false }),
    db
      .from("property_furnishing_profiles")
      .select("*")
      .eq("property_id", project.property_id)
      .maybeSingle(),
    db
      .from("furnishing_mood_boards")
      .select(
        "*,furnishing_mood_board_items(*,furnishing_products(name),furnishing_design_tokens(name,value,token_type))",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false }),
  ]);
  return {
    project: { ...project, property_furnishing_profiles: propertyProfile },
    packageVersion: packages,
    products: products ?? [],
    notes: notes ?? [],
    validations: validations ?? [],
    moodBoards: moodBoards ?? [],
  };
}
const offerProjection = (offer: Row) => ({
  id: String(offer.id),
  status: offer.status,
  availability: offer.availability,
  listedPrice:
    typeof offer.listed_price_minor === "number"
      ? {
          amountMinor: offer.listed_price_minor,
          currency: offer.currency ?? "USD",
        }
      : null,
  lastVerifiedAt: offer.last_verified_at ?? null,
});
export async function generateFurnishingPlanAction(formData: FormData) {
  const { user, profile, db } = await context(),
    projectId = value(formData, "projectId");
  const { project, packageVersion } = (await getProjectWorkspace(
    projectId,
  )) as Row;
  await authorize(db, profile, project.workspace_id);
  if (project.current_plan_version_id)
    throw new Error("PLAN_ALREADY_GENERATED");
  if (!packageVersion) throw new Error("APPROVED_PACKAGE_REQUIRED");
  const rooms: Row[] = project.furnishing_rooms ?? [],
    facts = {
      bedrooms: Number(
        project.property_furnishing_profiles?.bedroom_count ?? 1,
      ),
      bathrooms: Number(
        project.property_furnishing_profiles?.bathroom_count ?? 1,
      ),
      guests: Number(project.property_furnishing_profiles?.guest_capacity ?? 2),
      rooms: rooms.length,
      beds: Number(project.property_furnishing_profiles?.bedroom_count ?? 1),
    };
  const { data: plan, error } = await db
    .from("furnishing_plans")
    .insert({
      project_id: projectId,
      version_number: 1,
      status: "draft",
      package_snapshot: {
        packageVersionId: packageVersion.id,
        versionNumber: packageVersion.version_number,
      },
      design_snapshot: {
        designProfileVersionId: project.design_profile_version_id,
      },
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error("FURNISHING_OPERATION_FAILED");
  let total = 0,
    selectionOrder = 0;
  const compositions: Row[] =
    packageVersion.furnishing_package_room_composition ?? [];
  for (const room of rooms) {
    const composition =
      compositions.find((x: Row) => x.room_type === room.room_type) ||
      (room.room_type === "primary_bedroom"
        ? compositions.find((x: Row) => x.room_type === "bedroom")
        : null);
    if (!composition) continue;
    const roomVersion = composition.furnishing_room_package_versions;
    await db
      .from("furnishing_rooms")
      .update({ room_package_version_id: roomVersion.id, status: "planning" })
      .eq("id", room.id);
    for (const item of roomVersion.furnishing_room_package_items ?? []) {
      const rule = item.furnishing_quantity_rules,
        quantity = resolveQuantity(
          {
            id: rule.id,
            ruleType: rule.rule_type,
            multiplier: Number(rule.multiplier),
            minimum: rule.minimum === null ? null : Number(rule.minimum),
            maximum: rule.maximum === null ? null : Number(rule.maximum),
            customExpression: rule.custom_expression
              ? JSON.stringify(rule.custom_expression)
              : null,
            rounding: rule.rounding,
          },
          facts,
        ),
        product = item.furnishing_products,
        offer = product
          ? representativeOffer(
              (product.furnishing_product_offers ?? []).map(offerProjection),
            )
          : null,
        unit = offer?.listedPrice?.amountMinor ?? null,
        estimated = unit === null ? null : Math.round(unit * quantity);
      total += estimated ?? 0;
      let compatibility = null;
      if (product && project.design_profile_version_id) {
        const styleVersion =
          project.furnishing_design_profile_versions?.style_system_version_id;
        const { data: assignment } = await db
          .from("furnishing_product_style_assignments")
          .select("compatibility")
          .eq("product_id", product.id)
          .eq("style_system_version_id", styleVersion)
          .maybeSingle();
        compatibility = assignment?.compatibility ?? null;
      }
      await db.from("furnishing_product_selections").insert({
        furnishing_plan_id: plan.id,
        room_id: room.id,
        package_item_id: item.id,
        requirement_id: item.room_requirement_id,
        requirement_name:
          item.furnishing_room_requirements?.name ?? item.requirement_key,
        product_id: product?.id ?? null,
        selected_offer_id: offer?.id ?? null,
        quantity_rule_id: item.quantity_rule_id,
        resolved_quantity: quantity,
        purchase_quantity: quantity,
        estimated_unit_price_minor: unit,
        estimated_total_minor: estimated,
        price_observed_at: unit !== null ? new Date().toISOString() : null,
        selection_source: "package",
        selection_status: product ? "recommended" : "missing",
        required: item.priority === "required",
        priority: item.priority,
        style_compatibility: compatibility,
        sort_order: selectionOrder++,
      });
    }
  }
  await db
    .from("furnishing_plans")
    .update({
      estimated_subtotal_minor: total,
      estimated_total_minor: total,
      updated_at: new Date().toISOString(),
    })
    .eq("id", plan.id);
  await db
    .from("furnishing_projects")
    .update({
      current_plan_version_id: plan.id,
      plan_status: "draft",
      lifecycle_status: "designing",
      phase: "selections",
    })
    .eq("id", projectId);
  revalidatePath(`/admin/furnishing/projects/${projectId}`);
}
async function editableSelection(
  db: ReturnType<typeof createAdminClient>,
  selectionId: string,
  expectedRevision: number,
) {
  const { data, error } = await db
    .from("furnishing_product_selections")
    .select(
      "*,furnishing_plans!inner(id,status,revision,project_id,furnishing_projects!inner(workspace_id))",
    )
    .eq("id", selectionId)
    .eq("revision", expectedRevision)
    .eq("furnishing_plans.status", "draft")
    .single();
  if (error || !data) throw new Error("PLAN_CONFLICT_OR_IMMUTABLE");
  return data;
}
export async function replaceProjectSelectionAction(formData: FormData) {
  const { user, profile, db } = await context(),
    selectionId = value(formData, "selectionId"),
    revision = Number(formData.get("expectedRevision")),
    productId = value(formData, "productId"),
    offerId = value(formData, "offerId") || null;
  const selection = await editableSelection(db, selectionId, revision),
    plan = selection.furnishing_plans,
    workspace = plan.furnishing_projects.workspace_id;
  await authorize(db, profile, workspace);
  const { data: product } = await db
    .from("furnishing_products")
    .select(
      "id,furnishing_product_offers!furnishing_product_offers_product_id_fkey(*)",
    )
    .eq("id", productId)
    .single();
  const offer = offerId
    ? (product?.furnishing_product_offers ?? []).find(
        (x: Row) => x.id === offerId,
      )
    : representativeOffer(
        (product?.furnishing_product_offers ?? []).map(offerProjection),
      );
  const rawOffer =
      typeof offer?.listedPrice === "object"
        ? (product?.furnishing_product_offers ?? []).find(
            (x: Row) => x.id === offer.id,
          )
        : offer,
    unit =
      rawOffer?.listed_price_minor ?? offer?.listedPrice?.amountMinor ?? null,
    quantity =
      Number(selection.quantity_override ?? selection.resolved_quantity) -
      Number(selection.existing_quantity ?? 0);
  const { data: projectContext } = await db
    .from("furnishing_projects")
    .select(
      "design_profile_version_id,furnishing_design_profile_versions(style_system_version_id)",
    )
    .eq("id", plan.project_id)
    .single();
  const profileVersion = projectContext?.furnishing_design_profile_versions,
    styleVersionId = Array.isArray(profileVersion)
      ? profileVersion[0]?.style_system_version_id
      : (
          profileVersion as unknown as {
            style_system_version_id?: string;
          } | null
        )?.style_system_version_id,
    { data: styleAssignment } = styleVersionId
      ? await db
          .from("furnishing_product_style_assignments")
          .select("compatibility")
          .eq("product_id", productId)
          .eq("style_system_version_id", styleVersionId)
          .maybeSingle()
      : { data: null },
    compatibility = styleAssignment?.compatibility ?? null,
    exceptionReason = value(formData, "exceptionReason");
  if ((compatibility === null || compatibility === "avoid") && !exceptionReason)
    throw new Error("DESIGN_EXCEPTION_REASON_REQUIRED");
  const { error } = await db
    .from("furnishing_product_selections")
    .update({
      product_id: productId,
      selected_offer_id: rawOffer?.id ?? offerId,
      estimated_unit_price_minor: unit,
      estimated_total_minor:
        unit === null ? null : Math.round(unit * Math.max(0, quantity)),
      price_observed_at: unit === null ? null : new Date().toISOString(),
      selection_status: "replaced",
      selection_source: "substitution",
      style_compatibility: compatibility,
      revision: revision + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", selectionId)
    .eq("revision", revision);
  if (error) throw new Error("FURNISHING_OPERATION_FAILED");
  if (
    (compatibility === null || compatibility === "avoid") &&
    projectContext?.design_profile_version_id
  )
    await db.from("furnishing_design_exceptions").insert({
      design_profile_version_id: projectContext.design_profile_version_id,
      room_id: selection.room_id,
      product_id: productId,
      reason: exceptionReason,
      notes: value(formData, "exceptionNotes") || null,
      created_by: user.id,
    });
  await recalculatePlan(db, plan.id);
  revalidatePath(`/admin/furnishing/projects/${plan.project_id}`);
}
export async function changeSelectionOfferAction(formData: FormData) {
  const { profile, db } = await context(),
    selectionId = value(formData, "selectionId"),
    revision = Number(formData.get("expectedRevision")),
    offerId = value(formData, "offerId");
  const selection = await editableSelection(db, selectionId, revision),
    plan = selection.furnishing_plans;
  await authorize(db, profile, plan.furnishing_projects.workspace_id);
  const { data: offer } = await db
    .from("furnishing_product_offers")
    .select("id,product_id,listed_price_minor")
    .eq("id", offerId)
    .eq("product_id", selection.product_id)
    .eq("status", "active")
    .single();
  if (!offer) throw new Error("PRODUCT_OFFER_INVALID");
  const estimated =
    offer.listed_price_minor === null
      ? null
      : Math.round(
          Number(offer.listed_price_minor) *
            Number(selection.purchase_quantity),
        );
  const { error } = await db
    .from("furnishing_product_selections")
    .update({
      selected_offer_id: offer.id,
      estimated_unit_price_minor: offer.listed_price_minor,
      estimated_total_minor: estimated,
      price_observed_at: new Date().toISOString(),
      revision: revision + 1,
    })
    .eq("id", selectionId)
    .eq("revision", revision);
  if (error) throw new Error("FURNISHING_OPERATION_FAILED");
  await recalculatePlan(db, plan.id);
  revalidatePath(`/admin/furnishing/projects/${plan.project_id}`);
}
export async function markExistingInventoryAction(formData: FormData) {
  const { user, profile, db } = await context(),
    selectionId = value(formData, "selectionId"),
    revision = Number(formData.get("expectedRevision")),
    quantity = Number(formData.get("quantity"));
  const selection = await editableSelection(db, selectionId, revision),
    plan = selection.furnishing_plans;
  await authorize(db, profile, plan.furnishing_projects.workspace_id);
  const purchase = Math.max(
      0,
      Number(selection.quantity_override ?? selection.resolved_quantity) -
        quantity,
    ),
    estimated =
      selection.estimated_unit_price_minor === null
        ? null
        : Math.round(Number(selection.estimated_unit_price_minor) * purchase);
  await db
    .from("furnishing_product_selections")
    .update({
      existing_quantity: quantity,
      purchase_quantity: purchase,
      estimated_total_minor: estimated,
      selection_status: purchase === 0 ? "existing_inventory" : "selected",
      revision: revision + 1,
    })
    .eq("id", selectionId)
    .eq("revision", revision);
  await db.from("furnishing_existing_inventory").upsert(
    {
      selection_id: selectionId,
      quantity,
      condition: value(formData, "condition"),
      notes: value(formData, "notes") || null,
      recorded_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "selection_id" },
  );
  await recalculatePlan(db, plan.id);
  revalidatePath(`/admin/furnishing/projects/${plan.project_id}`);
}
export async function overrideSelectionQuantityAction(formData: FormData) {
  const { profile, db } = await context(),
    selectionId = value(formData, "selectionId"),
    revision = Number(formData.get("expectedRevision")),
    quantity = Number(formData.get("quantity"));
  const selection = await editableSelection(db, selectionId, revision),
    plan = selection.furnishing_plans;
  await authorize(db, profile, plan.furnishing_projects.workspace_id);
  if (!value(formData, "reason"))
    throw new Error("QUANTITY_OVERRIDE_REASON_REQUIRED");
  const purchase = Math.max(0, quantity - Number(selection.existing_quantity)),
    estimated =
      selection.estimated_unit_price_minor === null
        ? null
        : Math.round(Number(selection.estimated_unit_price_minor) * purchase);
  await db
    .from("furnishing_product_selections")
    .update({
      quantity_override: quantity,
      quantity_override_reason: value(formData, "reason"),
      purchase_quantity: purchase,
      estimated_total_minor: estimated,
      revision: revision + 1,
    })
    .eq("id", selectionId)
    .eq("revision", revision);
  await recalculatePlan(db, plan.id);
  revalidatePath(`/admin/furnishing/projects/${plan.project_id}`);
}
export async function acceptRoomDesignAction(formData: FormData) {
  const { user, profile, db } = await context(),
    roomId = value(formData, "roomId");
  const { data: room } = await db
    .from("furnishing_rooms")
    .select("id,project_id,furnishing_projects(workspace_id)")
    .eq("id", roomId)
    .single();
  if (!room) throw new Error("ROOM_NOT_FOUND");
  const workspaceId = Array.isArray(room.furnishing_projects)
    ? room.furnishing_projects[0]?.workspace_id
    : (room.furnishing_projects as unknown as { workspace_id?: string } | null)
        ?.workspace_id;
  await authorize(db, profile, workspaceId);
  await db
    .from("furnishing_rooms")
    .update({ status: "approved" })
    .eq("id", roomId);
  await db.from("furnishing_project_notes").insert({
    project_id: room.project_id,
    room_id: roomId,
    body: "Room design accepted by customer.",
    created_by: user.id,
  });
  revalidatePath(`/dashboard/furnishing/projects/${room.project_id}`);
  revalidatePath(`/admin/furnishing/projects/${room.project_id}`);
}
export async function requestRoomRevisionAction(formData: FormData) {
  const { user, profile, db } = await context(),
    roomId = value(formData, "roomId"),
    notes = value(formData, "notes");
  if (!notes) throw new Error("REVISION_NOTES_REQUIRED");
  const { data: room } = await db
    .from("furnishing_rooms")
    .select("id,project_id,furnishing_projects(workspace_id)")
    .eq("id", roomId)
    .single();
  if (!room) throw new Error("ROOM_NOT_FOUND");
  const workspaceId = Array.isArray(room.furnishing_projects)
    ? room.furnishing_projects[0]?.workspace_id
    : (room.furnishing_projects as unknown as { workspace_id?: string } | null)
        ?.workspace_id;
  await authorize(db, profile, workspaceId);
  await db
    .from("furnishing_rooms")
    .update({ status: "planning" })
    .eq("id", roomId);
  await db.from("furnishing_project_notes").insert({
    project_id: room.project_id,
    room_id: roomId,
    body: `Revision requested: ${notes}`,
    created_by: user.id,
  });
  revalidatePath(`/dashboard/furnishing/projects/${room.project_id}`);
  revalidatePath(`/admin/furnishing/projects/${room.project_id}`);
}
export async function approveMoodBoardAction(formData: FormData) {
  const { user, profile, db } = await context(),
    moodBoardId = value(formData, "moodBoardId");
  const { data: board } = await db
    .from("furnishing_mood_boards")
    .select("id,project_id,workspace_id")
    .eq("id", moodBoardId)
    .single();
  if (!board) throw new Error("MOOD_BOARD_NOT_FOUND");
  await authorize(db, profile, board.workspace_id);
  await db
    .from("furnishing_mood_boards")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", moodBoardId);
  await db.from("furnishing_project_notes").insert({
    project_id: board.project_id,
    body: "Mood board approved by customer.",
    created_by: user.id,
  });
  revalidatePath(`/dashboard/furnishing/projects/${board.project_id}`);
  revalidatePath(`/admin/furnishing/projects/${board.project_id}`);
}
export async function requestMoodBoardRevisionAction(formData: FormData) {
  const { user, profile, db } = await context(),
    moodBoardId = value(formData, "moodBoardId"),
    notes = value(formData, "notes");
  if (!notes) throw new Error("REVISION_NOTES_REQUIRED");
  const { data: board } = await db
    .from("furnishing_mood_boards")
    .select("id,project_id,workspace_id")
    .eq("id", moodBoardId)
    .single();
  if (!board) throw new Error("MOOD_BOARD_NOT_FOUND");
  await authorize(db, profile, board.workspace_id);
  await db
    .from("furnishing_mood_boards")
    .update({ status: "draft", updated_at: new Date().toISOString() })
    .eq("id", moodBoardId);
  await db.from("furnishing_project_notes").insert({
    project_id: board.project_id,
    body: `Mood board revision requested: ${notes}`,
    created_by: user.id,
  });
  revalidatePath(`/dashboard/furnishing/projects/${board.project_id}`);
  revalidatePath(`/admin/furnishing/projects/${board.project_id}`);
}
export async function completeProjectAction(formData: FormData) {
  const { profile, db } = await context(),
    projectId = value(formData, "projectId");
  const { data: project } = await db
    .from("furnishing_projects")
    .select("id,workspace_id,lifecycle_status")
    .eq("id", projectId)
    .single();
  if (!project) throw new Error("FURNISHING_PROJECT_NOT_FOUND");
  await authorize(db, profile, project.workspace_id);
  if (project.lifecycle_status === "completed") return;
  const { data: installation } = await db
    .from("furnishing_installation_projects")
    .select("id,status")
    .eq("project_id", projectId)
    .maybeSingle();
  if (!installation || installation.status !== "handed_off")
    throw new Error("FS007_HANDOFF_REQUIRED");
  const { data: baseline } = await db
    .from("furnishing_procurement_baselines")
    .select("id")
    .eq("project_id", projectId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (baseline) {
    const { count } = await db
      .from("furnishing_procurement_exceptions")
      .select("id", { count: "exact", head: true })
      .eq("baseline_id", baseline.id)
      .eq("severity", "blocking")
      .eq("status", "open");
    if (count) throw new Error("FS_PROCUREMENT_EXCEPTIONS_OPEN");
  }
  const { count: blockingPunch } = await db
    .from("furnishing_punch_list_items")
    .select("id", { count: "exact", head: true })
    .eq("installation_project_id", installation.id)
    .eq("blocking_launch", true)
    .neq("status", "resolved");
  if (blockingPunch) throw new Error("FS_PUNCH_LIST_OPEN");
  const { error } = await db
    .from("furnishing_projects")
    .update({ lifecycle_status: "completed", completed_at: new Date().toISOString() })
    .eq("id", projectId);
  if (error) throw new Error("FURNISHING_OPERATION_FAILED");
  revalidatePath(`/dashboard/furnishing/projects/${projectId}`);
  revalidatePath(`/admin/furnishing/projects/${projectId}`);
}
async function recalculatePlan(
  db: ReturnType<typeof createAdminClient>,
  planId: string,
) {
  const { data: rows } = await db
    .from("furnishing_product_selections")
    .select("estimated_total_minor")
    .eq("furnishing_plan_id", planId);
  const total = (rows ?? []).reduce(
    (n, x) => n + Number(x.estimated_total_minor ?? 0),
    0,
  );
  await db
    .from("furnishing_plans")
    .update({
      estimated_subtotal_minor: total,
      estimated_total_minor: total,
      revision:
        (
          await db
            .from("furnishing_plans")
            .select("revision")
            .eq("id", planId)
            .single()
        ).data?.revision + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", planId);
}
async function serverValidation(
  db: ReturnType<typeof createAdminClient>,
  planId: string,
) {
  const { data: plan } = await db
    .from("furnishing_plans")
    .select(
      "*,furnishing_projects!furnishing_plans_project_id_fkey(target_budget_minor,furnishing_rooms!furnishing_rooms_project_id_fkey(id,room_package_version_id)),furnishing_product_selections(*)",
    )
    .eq("id", planId)
    .single();
  if (!plan) throw new Error("PLAN_NOT_FOUND");
  const selections: Row[] = plan.furnishing_product_selections ?? [],
    result = validatePlan({
      selections: selections.map((x) => ({
        id: x.package_item_id ?? x.id,
        roomId: x.room_id,
        required: x.required,
        productId: x.product_id,
        resolvedQuantity: Number(x.quantity_override ?? x.resolved_quantity),
        existingQuantity: Number(x.existing_quantity),
        unitPriceMinor: x.estimated_unit_price_minor,
        selectionStatus: x.selection_status,
        offerAvailability: null,
        styleCompatibility: x.style_compatibility,
      })),
      requiredItemIds: selections
        .filter((x) => x.required)
        .map((x) => x.package_item_id ?? x.id),
      roomIds: plan.furnishing_projects.furnishing_rooms.map((x: Row) => x.id),
      roomsWithPackages: plan.furnishing_projects.furnishing_rooms
        .filter((x: Row) => x.room_package_version_id)
        .map((x: Row) => x.id),
      targetBudgetMinor: plan.furnishing_projects.target_budget_minor,
    });
  return { plan, result };
}
export async function validateFurnishingPlanAction(formData: FormData) {
  const { user, profile, db } = await context(),
    projectId = value(formData, "projectId"),
    planId = value(formData, "planId");
  const { plan, result } = await serverValidation(db, planId);
  await authorize(
    db,
    profile,
    (
      await db
        .from("furnishing_projects")
        .select("workspace_id")
        .eq("id", projectId)
        .single()
    ).data?.workspace_id,
  );
  await db.from("furnishing_plan_validation_runs").insert({
    furnishing_plan_id: planId,
    revision: plan.revision,
    errors: result.errors,
    warnings: result.warnings,
    estimated_total_minor: result.estimatedTotalMinor,
    created_by: user.id,
  });
  await db
    .from("furnishing_plans")
    .update({ validation_snapshot: result })
    .eq("id", planId);
  revalidatePath(`/admin/furnishing/projects/${projectId}`);
}
export async function submitOrApprovePlanAction(formData: FormData) {
  const { user, profile, db } = await context(),
    projectId = value(formData, "projectId"),
    planId = value(formData, "planId"),
    mode = value(formData, "mode"),
    { plan, result } = await serverValidation(db, planId);
  const { data: project } = await db
    .from("furnishing_projects")
    .select("workspace_id")
    .eq("id", projectId)
    .single();
  await authorize(db, profile, project?.workspace_id);
  if (!result.ready) throw new Error("PLAN_HAS_BLOCKING_ERRORS");
  if (mode === "submit") {
    await db
      .from("furnishing_plans")
      .update({ status: "awaiting_approval", validation_snapshot: result })
      .eq("id", planId)
      .eq("status", "draft");
    await db
      .from("furnishing_projects")
      .update({
        plan_status: "awaiting_approval",
        lifecycle_status: "awaiting_approval",
      })
      .eq("id", projectId);
  } else {
    if (plan.status !== "awaiting_approval")
      throw new Error("PLAN_NOT_AWAITING_APPROVAL");
    const { data: selections } = await db
      .from("furnishing_product_selections")
      .select("*")
      .eq("furnishing_plan_id", planId);
    await db
      .from("furnishing_plans")
      .update({
        status: "approved",
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        approval_snapshot: { approvedAt: new Date().toISOString(), selections },
        validation_snapshot: result,
      })
      .eq("id", planId);
    await db
      .from("furnishing_product_selections")
      .update({ selection_status: "approved" })
      .eq("furnishing_plan_id", planId)
      .in("selection_status", ["selected", "recommended", "replaced"]);
    await db
      .from("furnishing_projects")
      .update({
        plan_status: "approved",
        lifecycle_status: "approved",
        phase: "selections",
      })
      .eq("id", projectId);
  }
  revalidatePath(`/admin/furnishing/projects/${projectId}`);
}
export async function createPlanRevisionAction(formData: FormData) {
  const { user, profile, db } = await context(),
    projectId = value(formData, "projectId"),
    sourceId = value(formData, "planId");
  const { data: project } = await db
    .from("furnishing_projects")
    .select("workspace_id")
    .eq("id", projectId)
    .single();
  await authorize(db, profile, project?.workspace_id);
  const { data: source, error } = await db
    .from("furnishing_plans")
    .select("*,furnishing_product_selections(*)")
    .eq("id", sourceId)
    .eq("status", "approved")
    .single();
  if (error) throw new Error("FURNISHING_OPERATION_FAILED");
  const { data: next, error: ne } = await db
    .from("furnishing_plans")
    .insert({
      project_id: projectId,
      version_number: Number(source.version_number) + 1,
      based_on_plan_id: source.id,
      furnishing_package_version_id: source.furnishing_package_version_id,
      status: "draft",
      estimated_subtotal_minor: source.estimated_subtotal_minor,
      estimated_shipping_minor: source.estimated_shipping_minor,
      estimated_tax_minor: source.estimated_tax_minor,
      estimated_total_minor: source.estimated_total_minor,
      currency: source.currency,
      package_snapshot: source.package_snapshot,
      design_snapshot: source.design_snapshot,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (ne) throw new Error("FURNISHING_PLAN_REVISION_FAILED");
  if (source.furnishing_product_selections.length)
    await db.from("furnishing_product_selections").insert(
      source.furnishing_product_selections.map((x: Row) => ({
        furnishing_plan_id: next.id,
        room_id: x.room_id,
        package_item_id: x.package_item_id,
        requirement_id: x.requirement_id,
        requirement_name: x.requirement_name,
        product_id: x.product_id,
        selected_offer_id: x.selected_offer_id,
        quantity_rule_id: x.quantity_rule_id,
        resolved_quantity: x.resolved_quantity,
        estimated_unit_price_minor: x.estimated_unit_price_minor,
        estimated_total_minor: x.estimated_total_minor,
        currency: x.currency,
        price_observed_at: x.price_observed_at,
        selection_source: x.selection_source,
        selection_status:
          x.selection_status === "approved" ? "selected" : x.selection_status,
        required: x.required,
        priority: x.priority,
        existing_quantity: x.existing_quantity,
        purchase_quantity: x.purchase_quantity,
        quantity_override: x.quantity_override,
        quantity_override_reason: x.quantity_override_reason,
        style_compatibility: x.style_compatibility,
        sort_order: x.sort_order,
        notes: x.notes,
      })),
    );
  await db
    .from("furnishing_projects")
    .update({
      current_plan_version_id: next.id,
      plan_status: "draft",
      lifecycle_status: "designing",
    })
    .eq("id", projectId);
  revalidatePath(`/admin/furnishing/projects/${projectId}`);
}
