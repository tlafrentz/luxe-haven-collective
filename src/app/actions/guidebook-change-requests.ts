"use server";
import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile, requireRole } from "@/lib/auth/session";
import {
  evaluatePropertyAccess,
  evaluateWorkspacePermission,
  resolveWorkspaceAccessContext,
  SupabaseTeamAccessRepository,
} from "@/features/workspace";
import type { ChangeRequestInput } from "@/features/guidebook-studio";

async function context(
  workspaceId?: string,
  permission: "guidebooks.view" | "guidebooks.manage" = "guidebooks.view",
) {
  const { user } = await getSessionProfile();
  if (!user) throw new Error("permission_denied");
  const access = await resolveWorkspaceAccessContext(
    new SupabaseTeamAccessRepository(),
    user.id,
    workspaceId,
  );
  if (!evaluateWorkspacePermission(access, permission))
    throw new Error("permission_denied");
  return { user, access };
}

function mapRow(row: Record<string, unknown>): ChangeRequestInput {
  return {
    id: String(row.id),
    guidebookId: String(row.guidebook_id),
    sectionKey: row.section_key ? String(row.section_key) : null,
    description: String(row.description),
    replacementContent: row.replacement_content
      ? String(row.replacement_content)
      : null,
    imageUrls: Array.isArray(row.image_urls)
      ? row.image_urls.map(String)
      : [],
    urgency: row.urgency as ChangeRequestInput["urgency"],
    status: row.status as ChangeRequestInput["status"],
    requestedBy: String(row.requested_by),
    createdAt: String(row.created_at),
    resolutionNote: row.resolution_note ? String(row.resolution_note) : null,
    resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
  };
}

export async function listGuidebookChangeRequestsAction(
  guidebookId: string,
): Promise<readonly ChangeRequestInput[]> {
  const admin = createAdminClient();
  const { data: guidebook } = await admin
    .from("guidebooks")
    .select("id,workspace_id,property_id")
    .eq("id", guidebookId)
    .maybeSingle();
  if (!guidebook) return [];
  const { access } = await context(String(guidebook.workspace_id));
  if (!evaluatePropertyAccess(access, String(guidebook.property_id))) return [];
  const { data, error } = await admin
    .from("guidebook_change_requests")
    .select("*")
    .eq("guidebook_id", guidebookId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(mapRow);
}

const submitSchema = z.object({
  guidebookId: z.string().min(1),
  workspaceId: z.string().min(1),
  sectionKey: z.string().optional(),
  description: z.string().min(1, "Describe the change you'd like.").max(4000),
  replacementContent: z.string().optional(),
  urgency: z.enum(["low", "normal", "high"]).default("normal"),
});

export type SubmitChangeRequestState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

export async function submitGuidebookChangeRequestAction(
  _: SubmitChangeRequestState,
  formData: FormData,
): Promise<SubmitChangeRequestState> {
  const parsed = submitSchema.safeParse({
    guidebookId: formData.get("guidebookId"),
    workspaceId: formData.get("workspaceId"),
    sectionKey: formData.get("sectionKey") || undefined,
    description: formData.get("description"),
    replacementContent: formData.get("replacementContent") || undefined,
    urgency: formData.get("urgency") || "normal",
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const { guidebookId, workspaceId, sectionKey, description, replacementContent, urgency } =
    parsed.data;
  try {
    const { user, access } = await context(workspaceId, "guidebooks.manage");
    const admin = createAdminClient();
    const { data: guidebook } = await admin
      .from("guidebooks")
      .select("property_id")
      .eq("id", guidebookId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!guidebook || !evaluatePropertyAccess(access, String(guidebook.property_id)))
      return { ok: false, message: "This guidebook is not in your workspace." };
    const { error } = await admin.from("guidebook_change_requests").insert({
      guidebook_id: guidebookId,
      workspace_id: workspaceId,
      requested_by: user.id,
      section_key: sectionKey || null,
      description,
      replacement_content: replacementContent || null,
      urgency,
    });
    if (error) throw error;
    revalidatePath(`/dashboard/guidebooks/${guidebookId}`);
    revalidatePath(`/admin/guidebooks/${guidebookId}`);
    return { ok: true, message: "Your change request was sent to the Luxe Haven team." };
  } catch {
    return {
      ok: false,
      message: "We couldn't submit your request. Please try again.",
    };
  }
}

const assignSchema = z.object({
  guidebookId: z.string().min(1),
  authoringMode: z.enum(["self", "managed"]),
  producerId: z.string().optional(),
  targetPublishDate: z.string().optional(),
});

export async function assignGuidebookProducerAction(formData: FormData) {
  await requireRole(["admin"]);
  const parsed = assignSchema.safeParse({
    guidebookId: formData.get("guidebookId"),
    authoringMode: formData.get("authoringMode"),
    producerId: formData.get("producerId") || undefined,
    targetPublishDate: formData.get("targetPublishDate") || undefined,
  });
  if (!parsed.success) return;
  const admin = createAdminClient();
  await admin
    .from("guidebooks")
    .update({
      authoring_mode: parsed.data.authoringMode,
      producer_id: parsed.data.producerId || null,
      target_publish_date: parsed.data.targetPublishDate || null,
    })
    .eq("id", parsed.data.guidebookId);
  revalidatePath(`/admin/guidebooks/${parsed.data.guidebookId}`);
  revalidatePath("/admin/guidebooks");
}

const resolveSchema = z.object({
  requestId: z.string().min(1),
  guidebookId: z.string().min(1),
  status: z.enum(["in_progress", "resolved", "declined"]),
  resolutionNote: z.string().optional(),
});

export async function resolveChangeRequestAction(formData: FormData) {
  const { user } = await requireRole(["admin"]);
  const parsed = resolveSchema.safeParse({
    requestId: formData.get("requestId"),
    guidebookId: formData.get("guidebookId"),
    status: formData.get("status"),
    resolutionNote: formData.get("resolutionNote") || undefined,
  });
  if (!parsed.success) return;
  const admin = createAdminClient();
  const resolved = parsed.data.status !== "in_progress";
  await admin
    .from("guidebook_change_requests")
    .update({
      status: parsed.data.status,
      resolution_note: parsed.data.resolutionNote || null,
      resolved_by: resolved ? user.id : null,
      resolved_at: resolved ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.requestId);
  revalidatePath(`/admin/guidebooks/${parsed.data.guidebookId}`);
  revalidatePath(`/dashboard/guidebooks/${parsed.data.guidebookId}`);
}

export async function listGuidebookProducersAction(): Promise<
  readonly { id: string; name: string }[]
> {
  await requireRole(["admin"]);
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id,full_name,email")
    .eq("role", "admin")
    .order("full_name");
  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.full_name || row.email || row.id),
  }));
}
