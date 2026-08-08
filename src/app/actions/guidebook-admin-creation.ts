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
  let request = admin
    .from("profiles")
    .select("id,full_name,email")
    .eq("role", "owner")
    .order("full_name")
    .limit(50);
  if (query?.trim()) {
    const term = query.trim().replace(/[,()%]/g, "").slice(0, 120);
    if (term) request = request.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  }
  const { data } = await request;
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: row.full_name?.trim() || "Unnamed customer",
    email: row.email ? String(row.email) : null,
  }));
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
