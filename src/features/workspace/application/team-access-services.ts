import {
  TeamAccessPolicyError,
  assertRoleAssignmentAllowed,
  evaluateWorkspacePermission,
  normalizeInvitationEmail,
  normalizePropertyAccess,
  permissionsForRole,
  type PropertyAccessScope,
  type WorkspaceAccessContext,
  type WorkspaceInvitation,
  type WorkspaceMembership,
  type WorkspacePermission,
  type WorkspaceRole,
} from "../domain";

export type TeamAccessSummary = Readonly<{
  activeMembers: number;
  pendingInvitations: number;
  administrators: number;
  restrictedMembers: number;
}>;

export type TeamAccessActivity = Readonly<{
  id: string;
  action: string;
  actorName: string;
  targetLabel: string;
  occurredAt: string;
}>;

export interface TeamAccessRepository {
  resolve(profileId: string, workspaceId?: string): Promise<WorkspaceAccessContext | null>;
  members(context: WorkspaceAccessContext): Promise<readonly WorkspaceMembership[]>;
  invitations(context: WorkspaceAccessContext): Promise<readonly WorkspaceInvitation[]>;
  activity(context: WorkspaceAccessContext): Promise<readonly TeamAccessActivity[]>;
  properties(context: WorkspaceAccessContext): Promise<readonly Readonly<{ id: string; name: string }>[]>;
  invite(input: Readonly<{
    context: WorkspaceAccessContext;
    email: string;
    role: Exclude<WorkspaceRole, "owner">;
    scope: PropertyAccessScope;
    tokenHash: string;
    expiresAt: string;
    commandId: string;
  }>): Promise<WorkspaceInvitation>;
  resend(input: Readonly<{ context: WorkspaceAccessContext; invitationId: string; tokenHash: string; expiresAt: string; commandId: string }>): Promise<WorkspaceInvitation>;
  cancel(context: WorkspaceAccessContext, invitationId: string, commandId: string): Promise<void>;
  accept(profileId: string, workspaceId: string, token: string, commandId: string): Promise<WorkspaceAccessContext>;
  changeRole(input: Readonly<{ context: WorkspaceAccessContext; membershipId: string; role: WorkspaceRole; commandId: string }>): Promise<void>;
  changePropertyAccess(input: Readonly<{ context: WorkspaceAccessContext; membershipId: string; scope: PropertyAccessScope; commandId: string }>): Promise<void>;
  changeStatus(input: Readonly<{ context: WorkspaceAccessContext; membershipId: string; status: "active" | "suspended" | "removed"; commandId: string }>): Promise<void>;
}

export async function resolveWorkspaceAccessContext(
  repository: TeamAccessRepository,
  profileId: string,
  workspaceId?: string,
) {
  const context = await repository.resolve(profileId, workspaceId);
  if (!context || context.status !== "active") {
    throw new TeamAccessPolicyError("INACTIVE_MEMBERSHIP", "An active workspace membership is required.");
  }
  return context;
}

export function authorizeWorkspaceAction(
  context: WorkspaceAccessContext,
  permission: WorkspacePermission,
) {
  if (!evaluateWorkspacePermission(context, permission)) {
    throw new TeamAccessPolicyError("FORBIDDEN", "You do not have permission for this workspace action.");
  }
}

export function getAccessSummary(
  members: readonly WorkspaceMembership[],
  invitations: readonly WorkspaceInvitation[],
): TeamAccessSummary {
  return Object.freeze({
    activeMembers: members.filter(({ status }) => status === "active").length,
    pendingInvitations: invitations.filter(({ status }) => status === "pending").length,
    administrators: members.filter(
      ({ status, role }) => status === "active" && ["owner", "administrator"].includes(role),
    ).length,
    restrictedMembers: members.filter(
      ({ status, propertyAccess }) => status === "active" && propertyAccess.type !== "all",
    ).length,
  });
}

export async function inviteWorkspaceMember(
  repository: TeamAccessRepository,
  context: WorkspaceAccessContext,
  input: Readonly<{
    email: string;
    role: Exclude<WorkspaceRole, "owner">;
    scope: PropertyAccessScope;
    tokenHash: string;
    expiresAt: string;
    commandId: string;
  }>,
) {
  authorizeWorkspaceAction(context, "team.invite");
  return repository.invite({
    context,
    email: normalizeInvitationEmail(input.email),
    role: input.role,
    scope: normalizePropertyAccess(input.role, input.scope),
    tokenHash: input.tokenHash,
    expiresAt: input.expiresAt,
    commandId: input.commandId,
  });
}

export async function changeWorkspaceMemberRole(
  repository: TeamAccessRepository,
  context: WorkspaceAccessContext,
  members: readonly WorkspaceMembership[],
  membershipId: string,
  role: WorkspaceRole,
  commandId: string,
) {
  authorizeWorkspaceAction(context, "team.manage_roles");
  const member = members.find(({ id }) => id === membershipId);
  if (!member) throw new TeamAccessPolicyError("FORBIDDEN", "Member is not in this workspace.");
  assertRoleAssignmentAllowed({
    actorProfileId: context.profileId,
    actorRole: context.role,
    targetProfileId: member.profileId,
    currentRole: member.role,
    nextRole: role,
    activeOwnerCount: members.filter(({ role, status }) => role === "owner" && status === "active").length,
  });
  await repository.changeRole({ context, membershipId, role, commandId });
}

export async function changeWorkspacePropertyAccess(
  repository: TeamAccessRepository,
  context: WorkspaceAccessContext,
  member: WorkspaceMembership,
  scope: PropertyAccessScope,
  commandId: string,
) {
  authorizeWorkspaceAction(context, "team.manage_access");
  await repository.changePropertyAccess({
    context,
    membershipId: member.id,
    scope: normalizePropertyAccess(member.role, scope),
    commandId,
  });
}

export function contextFromMembership(
  membership: WorkspaceMembership,
  ownerProfileId: string,
): WorkspaceAccessContext {
  return Object.freeze({
    profileId: membership.profileId,
    workspaceId: membership.workspaceId,
    ownerId: membership.workspaceId,
    ownerProfileId,
    membershipId: membership.id,
    role: membership.role,
    status: membership.status,
    propertyAccess: membership.role === "owner" ? { type: "all" as const } : membership.propertyAccess,
    permissions: permissionsForRole(membership.role),
  });
}
