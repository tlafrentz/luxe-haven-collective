"use server";
import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/session";
import {
  createGuidebookWithReceipt,
  SupabaseGuidebookCommandReceiptRepository,
  SupabaseGuidebookCreationRepository,
  SupabaseGuidebookDraftRepository,
  type CommandContext,
} from "@/features/guidebook-studio";

export type AdminCustomerOption = {
  id: string;
  name: string;
  email: string | null;
};

export async function listCustomerWorkspacesAction(
  query?: string,
): Promise<readonly AdminCustomerOption[]> {
  await requireRole(["admin"]);
  const admin = createAdminClient();
  // properties.owner_id and every capability table (property_capability_enrollments,
  // guidebooks.workspace_id, etc.) reference owners.id, which is NOT the same row as
  // profiles.id — owners is a separate table keyed by profile_id. Returning the bare
  // profile id here (as this previously did) meant every downstream property/guidebook
  // lookup silently matched zero rows for every customer, regardless of what properties
  // they actually had.
  const { data } = await admin
    .from("owners")
    .select("id,profiles!owners_profile_id_fkey!inner(full_name,email,role)")
    .eq("profiles.role", "owner")
    .order("id")
    .limit(50);
  let rows = data ?? [];
  if (query?.trim()) {
    const term = query.trim().toLowerCase();
    rows = rows.filter((row) => {
      const profile = row.profiles as unknown as {
        full_name: string | null;
        email: string | null;
      };
      return (
        profile.full_name?.toLowerCase().includes(term) ||
        profile.email?.toLowerCase().includes(term)
      );
    });
  }
  return rows.map((row) => {
    const profile = row.profiles as unknown as {
      full_name: string | null;
      email: string | null;
    };
    return {
      id: String(row.id),
      name: profile.full_name?.trim() || "Unnamed customer",
      email: profile.email ? String(profile.email) : null,
    };
  });
}

export type AdminPropertyOption = {
  id: string;
  name: string;
  location: string;
  existingGuidebookId: string | null;
};

export async function listWorkspacePropertiesAction(
  workspaceId: string,
): Promise<readonly AdminPropertyOption[]> {
  await requireRole(["admin"]);
  const admin = createAdminClient();
  const [{ data: properties }, { data: guidebooks }] = await Promise.all([
    admin
      .from("properties")
      .select("id,name,city,state")
      .eq("owner_id", workspaceId)
      .order("name"),
    admin
      .from("guidebooks")
      .select("id,property_id")
      .eq("workspace_id", workspaceId),
  ]);
  const existingByProperty = new Map(
    (guidebooks ?? []).map((row) => [String(row.property_id), String(row.id)]),
  );
  return (properties ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    location: [row.city, row.state].filter(Boolean).join(", "),
    existingGuidebookId: existingByProperty.get(String(row.id)) ?? null,
  }));
}

const createPropertySchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().trim().min(1),
  address: z.string().trim().optional(),
  city: z.string().trim().min(1),
  state: z.string().trim().min(1),
  postalCode: z.string().trim().optional(),
  country: z.string().trim().min(1),
  propertyType: z.string().trim().min(1),
  timezone: z.string().trim().min(1),
  bedrooms: z.coerce.number().min(0).optional(),
  bathrooms: z.coerce.number().min(0).optional(),
  maxGuests: z.coerce.number().min(1).optional(),
  shortDescription: z.string().trim().optional(),
});

// Properties created here mirror what public.create_guidebook_flow_property
// does for the customer self-service flow, but that RPC has no admin bypass
// (it derives the actor from auth.uid() and requires an owner/administrator
// role in the target workspace), which an admin acting on a customer's
// behalf never has. Rather than change that RPC's security-definer contract,
// this performs the same inserts directly with the admin client.
export async function createWorkspacePropertyAsAdminAction(formData: FormData) {
  const { user } = await requireRole(["admin"]);
  const parsed = createPropertySchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    name: formData.get("name"),
    address: formData.get("address") || undefined,
    city: formData.get("city"),
    state: formData.get("state"),
    postalCode: formData.get("postalCode") || undefined,
    country: formData.get("country") || "US",
    propertyType: formData.get("propertyType"),
    timezone: formData.get("timezone"),
    bedrooms: formData.get("bedrooms") || undefined,
    bathrooms: formData.get("bathrooms") || undefined,
    maxGuests: formData.get("maxGuests") || undefined,
    shortDescription: formData.get("shortDescription") || undefined,
  });
  if (!parsed.success)
    redirect(
      `/admin/guidebooks/new?workspace=${formData.get("workspaceId")}&propertyError=invalid`,
    );
  const {
    workspaceId,
    name,
    address,
    city,
    state,
    postalCode,
    country,
    propertyType,
    timezone,
    bedrooms,
    bathrooms,
    maxGuests,
    shortDescription,
  } = parsed.data;
  const admin = createAdminClient();
  const slug = `${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${crypto.randomUUID().slice(0, 6)}`;
  const { data: property, error } = await admin
    .from("properties")
    .insert({
      owner_id: workspaceId,
      name,
      slug,
      description: "",
      short_description: shortDescription || null,
      address_line_1: address || null,
      city,
      state,
      postal_code: postalCode || null,
      country: country.toUpperCase(),
      property_type: propertyType,
      timezone,
      bedrooms: bedrooms ?? 0,
      bathrooms: bathrooms ?? 0,
      max_guests: maxGuests ?? 2,
      status: "draft",
      source: "manual",
    })
    .select("id")
    .single();
  if (error || !property)
    redirect(
      `/admin/guidebooks/new?workspace=${workspaceId}&propertyError=save_failed`,
    );
  await admin.from("property_workspace_configuration").upsert(
    {
      property_id: property.id,
      workspace_id: workspaceId,
      inclusion: "included",
      updated_by_profile_id: user.id,
    },
    { onConflict: "property_id" },
  );
  await admin.from("property_capability_enrollments").upsert(
    {
      workspace_id: workspaceId,
      property_id: property.id,
      capability: "guidebook",
      status: "enabled",
      source: "studio",
      created_by: user.id,
      enabled_at: new Date().toISOString(),
    },
    { onConflict: "property_id,capability" },
  );
  await admin.from("workspace_property_system_activity").insert({
    workspace_id: workspaceId,
    actor_profile_id: user.id,
    property_id: property.id,
    action: "property_created_from_guidebook_flow",
    command_id: `admin-create-property:${property.id}`,
  });
  redirect(`/admin/guidebooks/new?workspace=${workspaceId}&property=${property.id}`);
}

const createSchema = z.object({
  workspaceId: z.string().min(1),
  propertyId: z.string().min(1),
  title: z.string().min(1, "Give the guidebook a title."),
  authoringMode: z.enum(["self", "managed"]),
  producerId: z.string().optional(),
  targetPublishDate: z.string().optional(),
});

export async function createGuidebookAsAdminAction(formData: FormData) {
  const { user } = await requireRole(["admin"]);
  const parsed = createSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    propertyId: formData.get("propertyId"),
    title: formData.get("title"),
    authoringMode: formData.get("authoringMode") || "managed",
    producerId: formData.get("producerId") || undefined,
    targetPublishDate: formData.get("targetPublishDate") || undefined,
  });
  if (!parsed.success) return;
  const { workspaceId, propertyId, title, authoringMode, producerId, targetPublishDate } =
    parsed.data;

  const admin = createAdminClient();
  const { data: property } = await admin
    .from("properties")
    .select("id")
    .eq("id", propertyId)
    .eq("owner_id", workspaceId)
    .maybeSingle();
  if (!property) return;

  const commandId = `admin-create:${propertyId}:${Date.now()}`;
  const context: CommandContext = {
    commandId,
    correlationId: crypto.randomUUID(),
    actorId: user.id,
    workspaceId,
    guidebookId: propertyId,
    expectedRevision: 0,
    enteredAt: new Date().toISOString(),
  };
  const result = await createGuidebookWithReceipt(
    {
      drafts: new SupabaseGuidebookDraftRepository(admin),
      receipts: new SupabaseGuidebookCommandReceiptRepository(user.id),
      creation: new SupabaseGuidebookCreationRepository(admin),
      timeoutMs: 5000,
    },
    context,
    { propertyId, title },
  );
  if (!result.ok) return;

  await admin
    .from("guidebooks")
    .update({
      authoring_mode: authoringMode,
      producer_id: producerId || null,
      target_publish_date: targetPublishDate || null,
    })
    .eq("id", result.value.guidebookId);

  redirect(`/admin/guidebooks/${result.value.guidebookId}`);
}
