"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth/session";
import {
  evaluatePropertyAccess,
  evaluateWorkspacePermission,
  resolveWorkspaceAccessContext,
  SupabaseTeamAccessRepository,
} from "@/features/workspace";
import {
  getReservationContext,
  SupabaseReservationContextRepository,
} from "@/features/reservation-context";

type ConversationRow = {
  id: string; workspace_id: string; reservation_id: string; booking_id: string;
  guest_id: string; property_id: string; channel: string; status: string;
  assigned_to_profile_id: string | null; unread_count: number;
  last_activity_at: string; revision: number;
};

async function authorize(workspaceId?: string, permission: "communications.view" | "communications.reply" | "communications.manage" = "communications.view") {
  const { user } = await getSessionProfile();
  if (!user) throw new Error("permission_denied");
  const access = await resolveWorkspaceAccessContext(new SupabaseTeamAccessRepository(), user.id, workspaceId);
  if (!evaluateWorkspacePermission(access, permission)) throw new Error("permission_denied");
  return { user, access };
}

export async function getGuestCommunicationInbox(input: { workspaceId?: string; query?: string; status?: string } = {}) {
  try {
    const { access } = await authorize(input.workspaceId);
    const admin = createAdminClient();
    const { data, error } = await admin.from("guest_conversations").select("*").eq("workspace_id", access.workspaceId).order("last_activity_at", { ascending: false });
    if (error) throw error;
    const allowed = (data as ConversationRow[]).filter(row => evaluatePropertyAccess(access, row.property_id));
    const guestIds = [...new Set(allowed.map(row => row.guest_id))];
    const propertyIds = [...new Set(allowed.map(row => row.property_id))];
    const [{ data: guests }, { data: properties }] = await Promise.all([
      guestIds.length ? admin.from("guests").select("id,display_name").in("id", guestIds) : Promise.resolve({ data: [] }),
      propertyIds.length ? admin.from("properties").select("id,name").in("id", propertyIds) : Promise.resolve({ data: [] }),
    ]);
    const guestNames = new Map((guests ?? []).map((row: { id: string; display_name: string }) => [row.id, row.display_name]));
    const propertyNames = new Map((properties ?? []).map((row: { id: string; name: string }) => [row.id, row.name]));
    const query = input.query?.trim().toLowerCase();
    const conversations = allowed.filter(row => {
      if (input.status && row.status !== input.status) return false;
      if (!query) return true;
      return [row.reservation_id, row.booking_id, guestNames.get(row.guest_id), propertyNames.get(row.property_id)].some(value => value?.toLowerCase().includes(query));
    }).map(row => ({
      ...row,
      guestName: guestNames.get(row.guest_id) ?? "Guest",
      propertyName: propertyNames.get(row.property_id) ?? "Property",
    }));
    return { ok: true as const, workspaceId: access.workspaceId, conversations };
  } catch (error) {
    console.error("guest_communications_inbox_failed", { errorType: error instanceof Error ? error.message : "unexpected" });
    return { ok: false as const, code: "permission_denied", conversations: [] };
  }
}

export async function getGuestCommunicationWorkspaceRequest(conversationId: string) {
  try {
    const admin = createAdminClient();
    const { data: candidate } = await admin.from("guest_conversations").select("*").eq("id", conversationId).maybeSingle();
    if (!candidate) return { ok: false as const, code: "conversation_not_found" };
    const row = candidate as ConversationRow;
    const { access } = await authorize(row.workspace_id);
    if (!evaluatePropertyAccess(access, row.property_id)) return { ok: false as const, code: "permission_denied" };
    const canViewContact = access.role === "owner" || access.role === "administrator";
    const principal = { userId: access.profileId, workspaceId: access.workspaceId, role: access.role === "owner" ? "owner" as const : access.role === "administrator" ? "admin" as const : "cleaner" as const };
    const reservation = await getReservationContext(new SupabaseReservationContextRepository(), principal, row.booking_id, canViewContact ? "operational-contact" : "operational-summary");
    if (!reservation) return { ok: false as const, code: "reservation_not_found" };
    const [{ data: messages }, { data: notes }, { data: timeline }, { data: templates }, { data: links }, { data: guidebook }] = await Promise.all([
      admin.from("guest_communication_messages").select("*").eq("conversation_id", conversationId).order("created_at"),
      admin.from("guest_communication_notes").select("*").eq("conversation_id", conversationId).order("pinned", { ascending: false }).order("created_at", { ascending: false }),
      admin.from("guest_communication_timeline").select("*").eq("conversation_id", conversationId).order("occurred_at"),
      admin.from("guest_communication_templates").select("*").or(`workspace_id.is.null,workspace_id.eq.${access.workspaceId}`).eq("status", "active").order("title"),
      admin.from("guest_communication_action_links").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: false }),
      admin.from("guidebooks").select("id,title,public_slug,published_version,status").eq("property_id", row.property_id).eq("status", "published").maybeSingle(),
    ]);
    return { ok: true as const, conversation: row, reservation, messages: messages ?? [], notes: notes ?? [], timeline: timeline ?? [], templates: templates ?? [], actionLinks: links ?? [], guidebook: guidebook ? { ...guidebook, publicUrl: `/g/${guidebook.public_slug}` } : null };
  } catch (error) {
    console.error("guest_communication_workspace_failed", { conversationId, errorType: error instanceof Error ? error.message : "unexpected" });
    return { ok: false as const, code: error instanceof Error && error.message === "permission_denied" ? "permission_denied" : "unexpected" };
  }
}

export async function saveGuestCommunicationDraft(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  const scheduledFor = String(formData.get("scheduledFor") ?? "").trim();
  if (!conversationId || !body || body.length > 10_000) return;
  const admin = createAdminClient();
  const { data: candidate } = await admin.from("guest_conversations").select("*").eq("id", conversationId).maybeSingle();
  if (!candidate) throw new Error("conversation_not_found");
  const row = candidate as ConversationRow;
  const { user, access } = await authorize(row.workspace_id, "communications.reply");
  if (!evaluatePropertyAccess(access, row.property_id)) throw new Error("permission_denied");
  const createdAt = new Date().toISOString();
  const messageId = `guest-message-${crypto.randomUUID()}`;
  const deliveryStatus = scheduledFor ? "queued" : "draft";
  const { error } = await admin.from("guest_communication_messages").insert({
    id: messageId, conversation_id: conversationId, sender_type: "operator",
    sender_profile_id: user.id, sender_display_name: user.email ?? "Operator", body,
    delivery_status: deliveryStatus, scheduled_for: scheduledFor || null,
    created_at: createdAt, idempotency_key: `communication-draft-${crypto.randomUUID()}`,
  });
  if (error) throw error;
  await admin.from("guest_communication_timeline").insert({
    id: `guest-timeline-${crypto.randomUUID()}`, conversation_id: conversationId,
    event_type: "message", visibility: "internal", message_id: messageId,
    safe_summary: scheduledFor ? "Operator scheduled a reviewed message." : "Operator saved a draft.",
    occurred_at: createdAt,
  });
  await admin.from("guest_conversations").update({ status: "waiting-on-host", last_activity_at: createdAt, revision: row.revision + 1 }).eq("id", conversationId).eq("revision", row.revision);
  revalidatePath(`/dashboard/communications/${conversationId}`);
}

export async function addGuestCommunicationNote(formData: FormData) {
  const conversationId = String(formData.get("conversationId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!conversationId || !body || body.length > 5_000) return;
  const admin = createAdminClient();
  const { data: candidate } = await admin.from("guest_conversations").select("*").eq("id", conversationId).maybeSingle();
  if (!candidate) throw new Error("conversation_not_found");
  const row = candidate as ConversationRow;
  const { user, access } = await authorize(row.workspace_id, "communications.reply");
  if (!evaluatePropertyAccess(access, row.property_id)) throw new Error("permission_denied");
  const createdAt = new Date().toISOString();
  const noteId = `guest-note-${crypto.randomUUID()}`;
  const { error } = await admin.from("guest_communication_notes").insert({ id: noteId, conversation_id: conversationId, body, pinned: formData.get("pinned") === "on", author_profile_id: user.id, created_at: createdAt });
  if (error) throw error;
  await admin.from("guest_communication_timeline").insert({ id: `guest-timeline-${crypto.randomUUID()}`, conversation_id: conversationId, event_type: "internal-note", visibility: "internal", note_id: noteId, safe_summary: "Private internal note added.", occurred_at: createdAt });
  revalidatePath(`/dashboard/communications/${conversationId}`);
}
