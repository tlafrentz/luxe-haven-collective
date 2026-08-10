import { createClient } from "@/lib/supabase/server";

import {
  contextFromMembership,
  type TeamAccessActivity,
  type TeamAccessRepository,
} from "../application";
import {
  permissionsForRole,
  type PropertyAccessScope,
  type WorkspaceAccessContext,
  type WorkspaceInvitation,
  type WorkspaceMembership,
  type WorkspaceRole,
} from "../domain";

type MembershipRow = Readonly<{
  id: string;
  workspace_id: string;
  profile_id: string;
  role: WorkspaceRole;
  status: WorkspaceMembership["status"];
  property_access_mode: PropertyAccessScope["type"];
  invited_by_profile_id: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
  member?: { full_name: string | null; email: string | null } | readonly { full_name: string | null; email: string | null }[];
  owner?: { profile_id: string } | readonly { profile_id: string }[];
  access?: readonly { property_id: string }[];
}>;

type InvitationRow = Readonly<{
  id: string;
  workspace_id: string;
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  status: WorkspaceInvitation["status"];
  property_access_mode: PropertyAccessScope["type"];
  property_ids: string[];
  invited_by_profile_id: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}>;

function one<T>(value: T | readonly T[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function scope(mode: PropertyAccessScope["type"], ids: readonly string[]): PropertyAccessScope {
  if (mode === "selected") return { type: "selected", propertyIds: ids };
  return { type: mode };
}

function mapMembership(row: MembershipRow): WorkspaceMembership {
  const member = one(row.member);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    profileId: row.profile_id,
    role: row.role,
    status: row.status,
    propertyAccess: row.role === "owner"
      ? { type: "all" }
      : scope(row.property_access_mode, (row.access ?? []).map(({ property_id }) => property_id)),
    ...(row.invited_by_profile_id ? { invitedByProfileId: row.invited_by_profile_id } : {}),
    ...(row.joined_at ? { joinedAt: row.joined_at } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    member: {
      displayName: member?.full_name?.trim() || member?.email || "Workspace member",
      email: member?.email ?? "",
    },
  };
}

function mapInvitation(row: InvitationRow): WorkspaceInvitation {
  const status =
    row.status === "pending" && Date.parse(row.expires_at) <= Date.now()
      ? "expired"
      : row.status;
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email,
    role: row.role,
    status,
    propertyAccess: scope(row.property_access_mode, row.property_ids ?? []),
    invitedByProfileId: row.invited_by_profile_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const membershipSelection = `
  id, workspace_id, profile_id, role, status, property_access_mode,
  invited_by_profile_id, joined_at, created_at, updated_at,
  member:profiles!workspace_memberships_profile_id_fkey(full_name,email),
  owner:owners!workspace_memberships_workspace_id_fkey(profile_id),
  access:workspace_member_property_access(property_id)
`;

export class SupabaseTeamAccessRepository implements TeamAccessRepository {
  async resolve(profileId: string, workspaceId?: string) {
    const supabase = await createClient();
    let query = supabase
      .from("workspace_memberships")
      .select(membershipSelection)
      .eq("profile_id", profileId)
      .eq("status", "active");
    if (workspaceId) query = query.eq("workspace_id", workspaceId);
    const { data, error } = await query.order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (error) throw new Error(`Unable to resolve workspace access: ${error.message}`);
    if (data) {
      const row = data as unknown as MembershipRow;
      const membership = mapMembership(row);
      const owner = one(row.owner);
      if (!owner?.profile_id) throw new Error("Workspace owner identity is missing.");
      return contextFromMembership(membership, owner.profile_id);
    }
    // Platform admins operate on customer workspaces (e.g. creating a
    // guidebook "on behalf of" a customer via /admin/*) without ever holding
    // a workspace_memberships row there — that table models real team
    // membership for the customer-facing /dashboard/* experience, which is a
    // different concern from platform-admin access. Without this, every
    // admin-created record became unreachable through any route built on
    // resolveWorkspaceAccessContext the moment it needed a *specific*
    // workspaceId, since no membership row would ever exist to find.
    if (workspaceId) return this.resolveAsAdmin(profileId, workspaceId);
    return null;
  }

  private async resolveAsAdmin(profileId: string, workspaceId: string) {
    const supabase = await createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", profileId)
      .maybeSingle();
    if (profile?.role !== "admin") return null;
    const { data: owner } = await supabase
      .from("owners")
      .select("profile_id")
      .eq("id", workspaceId)
      .maybeSingle();
    if (!owner?.profile_id) return null;
    return Object.freeze({
      profileId,
      workspaceId,
      ownerId: workspaceId,
      ownerProfileId: owner.profile_id,
      membershipId: `platform-admin:${profileId}`,
      role: "owner" as const,
      status: "active" as const,
      propertyAccess: { type: "all" as const },
      permissions: permissionsForRole("owner"),
    });
  }

  async members(context: WorkspaceAccessContext) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("workspace_memberships")
      .select(membershipSelection)
      .eq("workspace_id", context.workspaceId)
      .neq("status", "removed")
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Unable to load workspace members: ${error.message}`);
    return (data ?? []).map((row) => mapMembership(row as unknown as MembershipRow));
  }

  async invitations(context: WorkspaceAccessContext) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("workspace_invitations")
      .select("id,workspace_id,email,role,status,property_access_mode,property_ids,invited_by_profile_id,expires_at,created_at,updated_at")
      .eq("workspace_id", context.workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Unable to load workspace invitations: ${error.message}`);
    return (data ?? []).map((row) => mapInvitation(row as InvitationRow));
  }

  async activity(context: WorkspaceAccessContext) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("workspace_access_activity")
      .select("id,action,target_label,occurred_at,actor:profiles!workspace_access_activity_actor_profile_id_fkey(full_name)")
      .eq("workspace_id", context.workspaceId)
      .order("occurred_at", { ascending: false })
      .limit(12);
    if (error) throw new Error(`Unable to load access activity: ${error.message}`);
    return (data ?? []).map((row): TeamAccessActivity => ({
      id: row.id,
      action: row.action,
      actorName: one(row.actor)?.full_name ?? "Workspace administrator",
      targetLabel: row.target_label,
      occurredAt: row.occurred_at,
    }));
  }

  async properties(context: WorkspaceAccessContext) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("properties")
      .select("id,name")
      .eq("owner_id", context.workspaceId)
      .order("name");
    if (error) throw new Error(`Unable to load workspace properties: ${error.message}`);
    return data ?? [];
  }

  async invite(input: Parameters<TeamAccessRepository["invite"]>[0]) {
    const result = await this.command(input.context, "invite", null, {
      email: input.email,
      role: input.role,
      propertyAccessMode: input.scope.type,
      propertyIds: input.scope.type === "selected" ? input.scope.propertyIds : [],
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
    }, input.commandId);
    return mapInvitation(result as unknown as InvitationRow);
  }

  async resend(input: Parameters<TeamAccessRepository["resend"]>[0]) {
    const result = await this.command(input.context, "resend-invitation", input.invitationId, {
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
    }, input.commandId);
    return mapInvitation(result as unknown as InvitationRow);
  }

  async cancel(context: WorkspaceAccessContext, invitationId: string, commandId: string) {
    await this.command(context, "cancel-invitation", invitationId, {}, commandId);
  }

  async accept(profileId: string, workspaceId: string, token: string, commandId: string) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("accept_workspace_invitation", {
      p_workspace_id: workspaceId,
      p_token: token,
      p_command_id: commandId,
    });
    if (error) throw new Error(`Unable to accept workspace invitation: ${error.message}`);
    const context = await this.resolve(profileId, workspaceId);
    if (!context) throw new Error("Accepted membership could not be resolved.");
    return context;
  }

  async changeRole(input: Parameters<TeamAccessRepository["changeRole"]>[0]) {
    await this.command(input.context, "change-role", input.membershipId, { role: input.role }, input.commandId);
  }

  async changePropertyAccess(input: Parameters<TeamAccessRepository["changePropertyAccess"]>[0]) {
    await this.command(input.context, "change-access", input.membershipId, {
      propertyAccessMode: input.scope.type,
      propertyIds: input.scope.type === "selected" ? input.scope.propertyIds : [],
    }, input.commandId);
  }

  async changeStatus(input: Parameters<TeamAccessRepository["changeStatus"]>[0]) {
    const action = input.status === "active" ? "restore" : input.status === "suspended" ? "suspend" : "remove";
    await this.command(input.context, action, input.membershipId, {}, input.commandId);
  }

  private async command(
    context: WorkspaceAccessContext,
    action: string,
    targetId: string | null,
    payload: Record<string, unknown>,
    commandId: string,
  ) {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("apply_workspace_access_command", {
      p_workspace_id: context.workspaceId,
      p_action: action,
      p_target_id: targetId,
      p_payload: payload,
      p_command_id: commandId,
    });
    if (error) throw new Error(`Workspace access command failed: ${error.message}`);
    return data as Record<string, unknown>;
  }
}
