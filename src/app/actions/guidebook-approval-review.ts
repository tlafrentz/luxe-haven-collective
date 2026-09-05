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
import { authorizeWithLegacyFallback, PRIVILEGE_IDS, type PlatformAccessClient, type PrivilegeId } from "@/features/platform-access";
import { SupabaseGuidebookDraftRepository } from "@/features/guidebook-studio";
import type {
  ApprovalRequestInput,
  ReviewCommentInput,
} from "@/features/guidebook-studio";

// PA-003: see guidebook-studio.ts's identical helper for the additive-only
// migration rationale (Contributor/Operator memberships have no PA-001
// role_assignments yet, so the legacy check must keep deciding access;
// a PA-001 grant can only extend it, never narrow it).
function legacyPermissionFor(privilegeId: PrivilegeId): "guidebooks.view" | "guidebooks.manage" {
  return privilegeId === PRIVILEGE_IDS.guidebooksGuidebookView ? "guidebooks.view" : "guidebooks.manage";
}
async function context(
  workspaceId: string | undefined,
  privilegeId: PrivilegeId = PRIVILEGE_IDS.guidebooksGuidebookView,
  scope?: { scopeType?: "workspace" | "property"; scopeId?: string | null },
) {
  const { user } = await getSessionProfile();
  if (!user) throw new Error("permission_denied");
  const access = await resolveWorkspaceAccessContext(
    new SupabaseTeamAccessRepository(),
    user.id,
    workspaceId,
  );
  const legacyAllowed = evaluateWorkspacePermission(access, legacyPermissionFor(privilegeId));
  const allowed = legacyAllowed
    ? true
    : await authorizeWithLegacyFallback({
        client: createAdminClient() as unknown as PlatformAccessClient,
        subjectId: access.profileId,
        workspaceId: access.workspaceId,
        privilegeId,
        scopeType: scope?.scopeType,
        scopeId: scope?.scopeId,
        legacyAllowed,
      });
  if (!allowed) throw new Error("permission_denied");
  return { user, access };
}

function mapRequest(row: Record<string, unknown>): ApprovalRequestInput {
  return {
    id: String(row.id),
    guidebookId: String(row.guidebook_id),
    draftRevision: Number(row.draft_revision),
    requestedBy: String(row.requested_by),
    status: row.status as ApprovalRequestInput["status"],
    decisionNote: row.decision_note ? String(row.decision_note) : null,
    decidedBy: row.decided_by ? String(row.decided_by) : null,
    decidedAt: row.decided_at ? String(row.decided_at) : null,
    createdAt: String(row.created_at),
  };
}

function mapComment(row: Record<string, unknown>): ReviewCommentInput {
  return {
    id: String(row.id),
    approvalRequestId: String(row.approval_request_id),
    sectionKey: row.section_key ? String(row.section_key) : null,
    comment: String(row.comment),
    authorId: String(row.author_id),
    createdAt: String(row.created_at),
  };
}

export async function getApprovalReviewAction(guidebookId: string): Promise<{
  request: ApprovalRequestInput | null;
  comments: readonly ReviewCommentInput[];
}> {
  const admin = createAdminClient();
  const { data: guidebook } = await admin
    .from("guidebooks")
    .select("id,workspace_id,property_id")
    .eq("id", guidebookId)
    .maybeSingle();
  if (!guidebook) return { request: null, comments: [] };
  const { access } = await context(String(guidebook.workspace_id), PRIVILEGE_IDS.guidebooksGuidebookView, {
    scopeType: "property",
    scopeId: String(guidebook.property_id),
  });
  if (!evaluatePropertyAccess(access, String(guidebook.property_id)))
    return { request: null, comments: [] };

  const { data: requestRow } = await admin
    .from("guidebook_approval_requests")
    .select("*")
    .eq("guidebook_id", guidebookId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!requestRow) return { request: null, comments: [] };
  const { data: commentRows } = await admin
    .from("guidebook_review_comments")
    .select("*")
    .eq("approval_request_id", requestRow.id)
    .order("created_at", { ascending: true });
  return {
    request: mapRequest(requestRow),
    comments: (commentRows ?? []).map(mapComment),
  };
}

export async function requestCustomerApprovalAction(formData: FormData) {
  const { user } = await requireRole(["admin"]);
  const guidebookId = String(formData.get("guidebookId") ?? "");
  if (!guidebookId) return;

  const admin = createAdminClient();
  const { data: guidebook } = await admin
    .from("guidebooks")
    .select("id,workspace_id,revision")
    .eq("id", guidebookId)
    .maybeSingle();
  if (!guidebook) return;

  const draft = await new SupabaseGuidebookDraftRepository(admin).load({
    workspaceId: String(guidebook.workspace_id),
    guidebookId,
    actorId: user.id,
  });
  const draftRevision = draft?.revision ?? Number(guidebook.revision);

  await admin
    .from("guidebook_approval_requests")
    .update({ status: "superseded" })
    .eq("guidebook_id", guidebookId)
    .eq("status", "pending");

  await admin.from("guidebook_approval_requests").insert({
    guidebook_id: guidebookId,
    workspace_id: guidebook.workspace_id,
    draft_revision: draftRevision,
    requested_by: user.id,
  });

  revalidatePath(`/admin/guidebooks/${guidebookId}`);
  revalidatePath(`/dashboard/guidebooks/${guidebookId}`);
}

const commentSchema = z.object({
  guidebookId: z.string().min(1),
  workspaceId: z.string().min(1),
  approvalRequestId: z.string().min(1),
  sectionKey: z.string().optional(),
  comment: z.string().min(1, "Write a comment first.").max(2000),
});

export type SubmitReviewCommentState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

export async function submitReviewCommentAction(
  _: SubmitReviewCommentState,
  formData: FormData,
): Promise<SubmitReviewCommentState> {
  const parsed = commentSchema.safeParse({
    guidebookId: formData.get("guidebookId"),
    workspaceId: formData.get("workspaceId"),
    approvalRequestId: formData.get("approvalRequestId"),
    sectionKey: formData.get("sectionKey") || undefined,
    comment: formData.get("comment"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please check the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }
  const { guidebookId, workspaceId, approvalRequestId, sectionKey, comment } =
    parsed.data;
  try {
    const admin = createAdminClient();
    const { data: guidebook } = await admin
      .from("guidebooks")
      .select("property_id")
      .eq("id", guidebookId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (!guidebook) return { ok: false, message: "This guidebook is not in your workspace." };
    const { user, access } = await context(workspaceId, PRIVILEGE_IDS.guidebooksGuidebookView, {
      scopeType: "property",
      scopeId: String(guidebook.property_id),
    });
    if (!evaluatePropertyAccess(access, String(guidebook.property_id)))
      return { ok: false, message: "This guidebook is not in your workspace." };
    const { error } = await admin.from("guidebook_review_comments").insert({
      approval_request_id: approvalRequestId,
      guidebook_id: guidebookId,
      workspace_id: workspaceId,
      section_key: sectionKey || null,
      comment,
      author_id: user.id,
    });
    if (error) throw error;
    revalidatePath(`/dashboard/guidebooks/${guidebookId}`);
    revalidatePath(`/admin/guidebooks/${guidebookId}`);
    return { ok: true, message: "Comment added." };
  } catch {
    return { ok: false, message: "We couldn't post that comment. Try again." };
  }
}

const decisionSchema = z.object({
  guidebookId: z.string().min(1),
  workspaceId: z.string().min(1),
  approvalRequestId: z.string().min(1),
  decision: z.enum(["approved", "changes_requested"]),
  decisionNote: z.string().optional(),
});

export async function decideGuidebookApprovalAction(formData: FormData) {
  const parsed = decisionSchema.safeParse({
    guidebookId: formData.get("guidebookId"),
    workspaceId: formData.get("workspaceId"),
    approvalRequestId: formData.get("approvalRequestId"),
    decision: formData.get("decision"),
    decisionNote: formData.get("decisionNote") || undefined,
  });
  if (!parsed.success) return;
  const { guidebookId, workspaceId, approvalRequestId, decision, decisionNote } =
    parsed.data;
  const admin = createAdminClient();
  const { data: guidebook } = await admin
    .from("guidebooks")
    .select("property_id")
    .eq("id", guidebookId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!guidebook) return;
  const { user, access } = await context(workspaceId, PRIVILEGE_IDS.guidebooksGuidebookApprove, {
    scopeType: "property",
    scopeId: String(guidebook.property_id),
  });
  if (!evaluatePropertyAccess(access, String(guidebook.property_id))) return;
  await admin
    .from("guidebook_approval_requests")
    .update({
      status: decision,
      decision_note: decisionNote || null,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", approvalRequestId)
    .eq("status", "pending");
  revalidatePath(`/dashboard/guidebooks/${guidebookId}`);
  revalidatePath(`/admin/guidebooks/${guidebookId}`);
}
