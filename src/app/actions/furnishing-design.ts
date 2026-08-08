"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
const value = (data: FormData, key: string) =>
    String(data.get(key) ?? "").trim(),
  list = (data: FormData, key: string) =>
    value(data, key)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
async function designAdmin() {
  const { user } = await requireRole(["admin"]);
  return { user, db: createAdminClient() };
}
export async function getDesignLibrary() {
  const { db } = await designAdmin();
  const [styles, products, profiles, properties, projects] = await Promise.all([
    db
      .from("furnishing_style_systems")
      .select(
        "*,furnishing_style_system_versions!furnishing_style_system_versions_style_system_id_fkey(*,furnishing_design_tokens(*),furnishing_product_style_assignments(id,compatibility))",
      )
      .neq("lifecycle_status", "archived")
      .order("updated_at", { ascending: false }),
    db
      .from("furnishing_products")
      .select("id,name,status,brand,category,default_media_asset_id")
      .eq("status", "approved")
      .order("name")
      .limit(500),
    db
      .from("furnishing_design_profiles")
      .select(
        "*,properties(name),furnishing_design_profile_versions!furnishing_design_profile_versions_design_profile_id_fkey(*)",
      )
      .order("created_at", { ascending: false }),
    db.from("properties").select("id,name,owner_id").order("name"),
    db
      .from("furnishing_projects")
      .select("id,name,workspace_id,property_id")
      .order("name"),
  ]);
  const error = [styles, products, profiles, properties, projects].find(
    (x) => x.error,
  )?.error;
  if (error) throw new Error(error.message);
  return {
    styles: styles.data ?? [],
    products: products.data ?? [],
    profiles: profiles.data ?? [],
    properties: properties.data ?? [],
    projects: projects.data ?? [],
  };
}
export async function getStyleSystem(styleId: string) {
  const { db } = await designAdmin();
  const [
    { data: style, error },
    { data: products },
    { data: profiles },
    { data: boards },
  ] = await Promise.all([
    db
      .from("furnishing_style_systems")
      .select(
        "*,furnishing_style_system_versions!furnishing_style_system_versions_style_system_id_fkey(*,furnishing_design_tokens(*),furnishing_product_style_assignments(*,furnishing_products(id,name,status,brand,category)))",
      )
      .eq("id", styleId)
      .single(),
    db
      .from("furnishing_products")
      .select(
        "id,name,status,brand,category,furnishing_product_offers!furnishing_product_offers_product_id_fkey(id,status,availability,listed_price_minor)",
      )
      .eq("status", "approved")
      .order("name")
      .limit(500),
    db
      .from("furnishing_design_profiles")
      .select("id,name,status,style_system_version_id")
      .order("created_at", { ascending: false }),
    db
      .from("furnishing_mood_boards")
      .select("id,name,status,design_profile_version_id")
      .order("updated_at", { ascending: false }),
  ]);
  if (error) throw new Error(error.message);
  return {
    style,
    products: products ?? [],
    profiles: profiles ?? [],
    boards: boards ?? [],
  };
}
export async function createStyleSystemAction(formData: FormData) {
  const { user, db } = await designAdmin(),
    name = value(formData, "name"),
    slug =
      value(formData, "slug") ||
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
  const { data: style, error } = await db
    .from("furnishing_style_systems")
    .insert({
      workspace_id: null,
      name,
      slug,
      description: value(formData, "description") || null,
      scope: "platform",
      lifecycle_status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { data: version, error: ve } = await db
    .from("furnishing_style_system_versions")
    .insert({
      style_system_id: style.id,
      version_number: 1,
      lifecycle_status: "draft",
      design_principles: list(formData, "principles"),
      aesthetic_tags: list(formData, "aestheticTags"),
      mood_tags: list(formData, "moodTags"),
      contextual_tags: list(formData, "contextualTags"),
      positioning_tags: list(formData, "positioningTags"),
      created_by: user.id,
    })
    .select("id")
    .single();
  if (ve) throw new Error(ve.message);
  await db
    .from("furnishing_style_systems")
    .update({ current_version_id: version.id })
    .eq("id", style.id);
  redirect(`/admin/furnishing/styles/${style.id}`);
}
export async function addDesignTokenAction(formData: FormData) {
  const { db } = await designAdmin(),
    styleId = value(formData, "styleId"),
    versionId = value(formData, "versionId");
  const { data: version } = await db
    .from("furnishing_style_system_versions")
    .select("id")
    .eq("id", versionId)
    .eq("lifecycle_status", "draft")
    .maybeSingle();
  if (!version) throw new Error("APPROVED_STYLE_VERSION_IMMUTABLE");
  const { count } = await db
    .from("furnishing_design_tokens")
    .select("id", { count: "exact", head: true })
    .eq("style_system_version_id", versionId);
  const { error } = await db
    .from("furnishing_design_tokens")
    .insert({
      style_system_version_id: versionId,
      token_type: value(formData, "tokenType"),
      name: value(formData, "name"),
      value: value(formData, "tokenValue") || null,
      description: value(formData, "description") || null,
      priority: value(formData, "priority"),
      sort_order: count ?? 0,
    });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/furnishing/styles/${styleId}`);
}
export async function assignProductStyleAction(formData: FormData) {
  const { user, db } = await designAdmin(),
    styleId = value(formData, "styleId"),
    versionId = value(formData, "versionId"),
    productId = value(formData, "productId");
  const { data: version } = await db
    .from("furnishing_style_system_versions")
    .select("id")
    .eq("id", versionId)
    .eq("lifecycle_status", "draft")
    .maybeSingle();
  if (!version) throw new Error("APPROVED_STYLE_VERSION_IMMUTABLE");
  const { error } = await db
    .from("furnishing_product_style_assignments")
    .upsert(
      {
        product_id: productId,
        style_system_version_id: versionId,
        compatibility: value(formData, "compatibility"),
        rationale: value(formData, "rationale") || null,
        provenance: "curated",
        created_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "product_id,style_system_version_id" },
    );
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/furnishing/styles/${styleId}`);
}
export async function updateStyleStatusAction(formData: FormData) {
  const { user, db } = await designAdmin(),
    styleId = value(formData, "styleId"),
    versionId = value(formData, "versionId"),
    status = value(formData, "status");
  if (!["in_review", "approved"].includes(status))
    throw new Error("STYLE_STATUS_INVALID");
  const { error } = await db
    .from("furnishing_style_system_versions")
    .update({
      lifecycle_status: status,
      approved_by: status === "approved" ? user.id : null,
      approved_at: status === "approved" ? new Date().toISOString() : null,
    })
    .eq("id", versionId);
  if (error) throw new Error(error.message);
  await db
    .from("furnishing_style_systems")
    .update({ lifecycle_status: status, updated_at: new Date().toISOString() })
    .eq("id", styleId);
  revalidatePath(`/admin/furnishing/styles/${styleId}`);
}
export async function createNextStyleVersionAction(formData: FormData) {
  const { user, db } = await designAdmin(),
    styleId = value(formData, "styleId"),
    sourceId = value(formData, "versionId");
  const { data: source, error } = await db
    .from("furnishing_style_system_versions")
    .select(
      "*,furnishing_design_tokens(*),furnishing_product_style_assignments(*)",
    )
    .eq("id", sourceId)
    .eq("style_system_id", styleId)
    .single();
  if (error) throw new Error(error.message);
  const { data: max } = await db
    .from("furnishing_style_system_versions")
    .select("version_number")
    .eq("style_system_id", styleId)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();
  const { data: next, error: ne } = await db
    .from("furnishing_style_system_versions")
    .insert({
      style_system_id: styleId,
      version_number: Number(max?.version_number ?? 0) + 1,
      lifecycle_status: "draft",
      design_principles: source.design_principles,
      aesthetic_tags: source.aesthetic_tags,
      mood_tags: source.mood_tags,
      contextual_tags: source.contextual_tags,
      positioning_tags: source.positioning_tags,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (ne) throw new Error(ne.message);
  if (source.furnishing_design_tokens.length)
    await db
      .from("furnishing_design_tokens")
      .insert(
        source.furnishing_design_tokens.map((x: Record<string, unknown>) => ({
          style_system_version_id: next.id,
          token_type: x.token_type,
          name: x.name,
          value: x.value,
          description: x.description,
          media_asset_id: x.media_asset_id,
          priority: x.priority,
          sort_order: x.sort_order,
        })),
      );
  if (source.furnishing_product_style_assignments.length)
    await db
      .from("furnishing_product_style_assignments")
      .insert(
        source.furnishing_product_style_assignments.map(
          (x: Record<string, unknown>) => ({
            style_system_version_id: next.id,
            product_id: x.product_id,
            compatibility: x.compatibility,
            rationale: x.rationale,
            matched_token_ids: x.matched_token_ids,
            provenance: x.provenance,
            created_by: user.id,
          }),
        ),
      );
  await db
    .from("furnishing_style_systems")
    .update({
      current_version_id: next.id,
      lifecycle_status: "draft",
      updated_at: new Date().toISOString(),
    })
    .eq("id", styleId);
  redirect(`/admin/furnishing/styles/${styleId}`);
}
export async function createDesignProfileAction(formData: FormData) {
  const { user, db } = await designAdmin(),
    propertyId = value(formData, "propertyId"),
    styleVersionId = value(formData, "styleVersionId");
  const { data: property } = await db
    .from("properties")
    .select("owner_id")
    .eq("id", propertyId)
    .single();
  if (!property?.owner_id) throw new Error("DESIGN_PROFILE_WORKSPACE_REQUIRED");
  const { data: profile, error } = await db
    .from("furnishing_design_profiles")
    .insert({
      workspace_id: property.owner_id,
      property_id: propertyId,
      name: value(formData, "name"),
      style_system_version_id: styleVersionId,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const { data: version, error: ve } = await db
    .from("furnishing_design_profile_versions")
    .insert({
      design_profile_id: profile.id,
      version_number: 1,
      style_system_version_id: styleVersionId,
      status: "draft",
      positioning_tier: value(formData, "tier"),
      mood_tags: list(formData, "moodTags"),
      contextual_tags: list(formData, "contextualTags"),
      notes: value(formData, "notes") || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (ve) throw new Error(ve.message);
  await db
    .from("furnishing_design_profiles")
    .update({ current_version_id: version.id })
    .eq("id", profile.id);
  redirect(`/admin/furnishing/styles/profiles/${profile.id}`);
}
export async function getDesignProfile(profileId: string) {
  const { db } = await designAdmin();
  const { data: profile, error } = await db
    .from("furnishing_design_profiles")
    .select(
      "*,properties(name),furnishing_design_profile_versions!furnishing_design_profile_versions_design_profile_id_fkey(*,furnishing_style_system_versions(*,furnishing_style_systems!furnishing_style_system_versions_style_system_id_fkey(name),furnishing_design_tokens(*)),furnishing_room_design_directions(*),furnishing_mood_boards(*,furnishing_mood_board_items(*)))",
    )
    .eq("id", profileId)
    .single();
  if (error) throw new Error(error.message);
  const { data: rooms } = await db
    .from("furnishing_rooms")
    .select("id,name,room_type")
    .eq(
      "project_id",
      profile.project_id ?? "00000000-0000-0000-0000-000000000000",
    )
    .order("sort_order");
  return { profile, rooms: rooms ?? [] };
}
