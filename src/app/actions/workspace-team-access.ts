"use server";

import { revalidatePath } from "next/cache";

import { sendEmail } from "@/lib/email/send";
import { requireUser } from "@/lib/auth/session";
import {
  SupabaseTeamAccessRepository,
  authorizeWorkspaceAction,
  changeWorkspaceMemberRole,
  changeWorkspacePropertyAccess,
  inviteWorkspaceMember,
  resolveWorkspaceAccessContext,
  type PropertyAccessScope,
  type WorkspaceRole,
} from "@/features/workspace";
import { createWorkspaceInvitationToken } from "@/features/workspace/infrastructure/invitation-token";

export type TeamActionResult = Readonly<{
  ok: boolean;
  message: string;
  code?: string;
}>;

const repository = () => new SupabaseTeamAccessRepository();
const refresh = () => {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/workspace");
  revalidatePath("/dashboard/workspace/team");
  revalidatePath("/properties");
  revalidatePath("/bookings");
};

function invitationHtml(input: Readonly<{ organization: string; url: string; role: string; expiresAt: string }>) {
  const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  return `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#171412"><h1>Join ${escape(input.organization)}</h1><p>You were invited to the Luxe Haven workspace as ${escape(input.role)}.</p><p><a href="${escape(input.url)}">Accept workspace invitation</a></p><p>This secure invitation expires ${escape(input.expiresAt)}.</p></div>`;
}

function accessScope(mode: string, propertyIds: readonly string[]): PropertyAccessScope {
  if (mode === "all") return { type: "all" };
  if (mode === "selected") return { type: "selected", propertyIds };
  return { type: "none" };
}

async function contextForCurrentUser(workspaceId?: string) {
  const { user } = await requireUser();
  return resolveWorkspaceAccessContext(repository(), user.id, workspaceId);
}

export async function inviteTeamMemberAction(input: Readonly<{
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  propertyAccessMode: string;
  propertyIds: readonly string[];
  commandId: string;
}>): Promise<TeamActionResult> {
  let invitationId: string | null = null;
  try {
    const context = await contextForCurrentUser();
    const secure = createWorkspaceInvitationToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const adapter = repository();
    const invitation = await inviteWorkspaceMember(adapter, context, {
      email: input.email,
      role: input.role,
      scope: accessScope(input.propertyAccessMode, input.propertyIds),
      tokenHash: secure.hash,
      expiresAt,
      commandId: input.commandId,
    });
    invitationId = invitation.id;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const url = `${siteUrl}/dashboard/workspace/team/accept?workspace=${encodeURIComponent(context.workspaceId)}&token=${encodeURIComponent(secure.token)}`;
    await sendEmail({
      to: invitation.email,
      subject: "You’re invited to a Luxe Haven workspace",
      html: invitationHtml({
        organization: "your hospitality team",
        url,
        role: invitation.role,
        expiresAt: new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(expiresAt)),
      }),
    });
    refresh();
    return { ok: true, message: `Invitation sent to ${invitation.email}.` };
  } catch (error) {
    if (invitationId) {
      try {
        const context = await contextForCurrentUser();
        await repository().cancel(context, invitationId, `${input.commandId}:delivery-failed`);
      } catch (rollbackError) {
        console.error("Unable to cancel undelivered workspace invitation.", { rollbackError });
      }
    }
    return { ok: false, code: "invite-failed", message: error instanceof Error ? error.message : "The invitation could not be sent. No access was granted." };
  }
}

export async function resendTeamInvitationAction(input: Readonly<{
  workspaceId: string;
  invitationId: string;
  email: string;
  role: string;
  commandId: string;
}>): Promise<TeamActionResult> {
  try {
    const context = await contextForCurrentUser(input.workspaceId);
    authorizeWorkspaceAction(context, "team.invite");
    const secure = createWorkspaceInvitationToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await repository().resend({
      context,
      invitationId: input.invitationId,
      tokenHash: secure.hash,
      expiresAt,
      commandId: input.commandId,
    });
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    await sendEmail({
      to: input.email,
      subject: "Your Luxe Haven workspace invitation",
      html: invitationHtml({
        organization: "your hospitality team",
        url: `${siteUrl}/dashboard/workspace/team/accept?workspace=${encodeURIComponent(context.workspaceId)}&token=${encodeURIComponent(secure.token)}`,
        role: input.role,
        expiresAt: new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(expiresAt)),
      }),
    });
    refresh();
    return { ok: true, message: `Invitation resent to ${input.email}.` };
  } catch (error) {
    return { ok: false, code: "resend-failed", message: error instanceof Error ? error.message : "The invitation could not be resent." };
  }
}

export async function cancelTeamInvitationAction(input: Readonly<{
  workspaceId: string;
  invitationId: string;
  commandId: string;
}>): Promise<TeamActionResult> {
  try {
    const context = await contextForCurrentUser(input.workspaceId);
    authorizeWorkspaceAction(context, "team.invite");
    await repository().cancel(context, input.invitationId, input.commandId);
    refresh();
    return { ok: true, message: "Invitation cancelled. It can no longer be accepted." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Invitation cancellation failed." };
  }
}

export async function updateTeamMemberAction(input: Readonly<{
  workspaceId: string;
  membershipId: string;
  action: "role" | "access" | "suspend" | "restore" | "remove";
  role?: WorkspaceRole;
  propertyAccessMode?: string;
  propertyIds?: readonly string[];
  commandId: string;
}>): Promise<TeamActionResult> {
  try {
    const adapter = repository();
    const context = await resolveWorkspaceAccessContext(adapter, (await requireUser()).user.id, input.workspaceId);
    const members = await adapter.members(context);
    const member = members.find(({ id }) => id === input.membershipId);
    if (!member) throw new Error("Workspace member was not found.");
    if (input.action === "role" && input.role) {
      await changeWorkspaceMemberRole(adapter, context, members, input.membershipId, input.role, input.commandId);
    } else if (input.action === "access" && input.propertyAccessMode) {
      await changeWorkspacePropertyAccess(
        adapter,
        context,
        member,
        accessScope(input.propertyAccessMode, input.propertyIds ?? []),
        input.commandId,
      );
    } else {
      authorizeWorkspaceAction(context, input.action === "remove" ? "team.remove" : "team.suspend");
      await adapter.changeStatus({
        context,
        membershipId: input.membershipId,
        status: input.action === "restore" ? "active" : input.action === "suspend" ? "suspended" : "removed",
        commandId: input.commandId,
      });
    }
    refresh();
    return { ok: true, message: "Workspace access updated." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Workspace access could not be updated." };
  }
}

export async function acceptTeamInvitationAction(input: Readonly<{
  workspaceId: string;
  token: string;
  commandId: string;
}>): Promise<TeamActionResult> {
  try {
    const { user } = await requireUser();
    await repository().accept(user.id, input.workspaceId, input.token, input.commandId);
    refresh();
    return { ok: true, message: "Invitation accepted. Workspace access is active." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Invitation could not be accepted." };
  }
}
