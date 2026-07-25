export type WorkspaceRole =
  | "owner"
  | "administrator"
  | "operator"
  | "contributor"
  | "viewer";

export type MembershipStatus =
  | "invited"
  | "active"
  | "suspended"
  | "removed"
  | "expired";

export type WorkspacePermission =
  | "workspace.view"
  | "organization.update"
  | "team.view"
  | "team.invite"
  | "team.manage_roles"
  | "team.manage_access"
  | "team.suspend"
  | "team.remove"
  | "properties.view"
  | "properties.manage"
  | "connections.view"
  | "connections.manage"
  | "bookings.view"
  | "bookings.operate"
  | "intelligence.view"
  | "actions.view"
  | "actions.manage"
  | "reports.view"
  | "reports.generate"
  | "guidebooks.view"
  | "guidebooks.manage";

export type PropertyAccessScope =
  | Readonly<{ type: "all" }>
  | Readonly<{ type: "selected"; propertyIds: readonly string[] }>
  | Readonly<{ type: "none" }>;

export type WorkspaceMembership = Readonly<{
  id: string;
  workspaceId: string;
  profileId: string;
  role: WorkspaceRole;
  status: MembershipStatus;
  propertyAccess: PropertyAccessScope;
  invitedByProfileId?: string;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
  member: Readonly<{
    displayName: string;
    email: string;
  }>;
}>;

export type WorkspaceInvitation = Readonly<{
  id: string;
  workspaceId: string;
  email: string;
  role: Exclude<WorkspaceRole, "owner">;
  status: "pending" | "accepted" | "cancelled" | "expired";
  propertyAccess: PropertyAccessScope;
  invitedByProfileId: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}>;

export type WorkspaceAccessContext = Readonly<{
  profileId: string;
  workspaceId: string;
  ownerId: string;
  ownerProfileId: string;
  membershipId: string;
  role: WorkspaceRole;
  status: MembershipStatus;
  propertyAccess: PropertyAccessScope;
  permissions: ReadonlySet<WorkspacePermission>;
}>;

export const workspaceRolePolicyVersion = "workspace-role-policy-v1";

const viewer: readonly WorkspacePermission[] = [
  "workspace.view", "properties.view", "bookings.view", "intelligence.view",
  "actions.view", "reports.view", "guidebooks.view",
];
const contributor: readonly WorkspacePermission[] = [
  ...viewer, "bookings.operate", "actions.manage", "reports.generate",
  "guidebooks.manage",
];
const operator: readonly WorkspacePermission[] = [
  ...contributor, "properties.manage",
];
const administrator: readonly WorkspacePermission[] = [
  ...operator, "organization.update", "team.view", "team.invite",
  "team.manage_roles", "team.manage_access", "team.suspend", "team.remove",
  "connections.view", "connections.manage",
];
const owner: readonly WorkspacePermission[] = [...administrator];

export const workspaceRolePermissions: Readonly<
  Record<WorkspaceRole, readonly WorkspacePermission[]>
> = Object.freeze({ owner, administrator, operator, contributor, viewer });

export function permissionsForRole(role: WorkspaceRole) {
  return new Set(workspaceRolePermissions[role]) as ReadonlySet<WorkspacePermission>;
}

export function evaluateWorkspacePermission(
  context: WorkspaceAccessContext,
  permission: WorkspacePermission,
): boolean {
  return context.status === "active" && context.permissions.has(permission);
}

export function evaluatePropertyAccess(
  context: Pick<WorkspaceAccessContext, "status" | "role" | "propertyAccess">,
  propertyId: string,
): boolean {
  if (context.status !== "active") return false;
  if (context.role === "owner") return true;
  if (context.propertyAccess.type === "all") return true;
  if (context.propertyAccess.type === "none") return false;
  return context.propertyAccess.propertyIds.includes(propertyId);
}

export function normalizePropertyAccess(
  role: WorkspaceRole,
  scope: PropertyAccessScope,
): PropertyAccessScope {
  if (role === "owner" || role === "administrator") return Object.freeze({ type: "all" });
  if (scope.type !== "selected") return Object.freeze(scope);
  const propertyIds = [...new Set(scope.propertyIds.map((value) => value.trim()).filter(Boolean))];
  if (!propertyIds.length) {
    throw new TeamAccessPolicyError(
      "INVALID_PROPERTY_SCOPE",
      "Selected-property access requires at least one property.",
    );
  }
  return Object.freeze({ type: "selected", propertyIds: Object.freeze(propertyIds) });
}

export function capabilitySummary(role: WorkspaceRole): readonly string[] {
  const summaries: Record<WorkspaceRole, readonly string[]> = {
    owner: ["Full workspace administration", "All properties", "All operational products"],
    administrator: ["Manage team below Owner", "All properties", "Workspace configuration"],
    operator: ["Operate assigned properties", "Bookings and actions", "Reports and intelligence"],
    contributor: ["Limited assigned-property operations", "Actions and guidebooks", "No workspace administration"],
    viewer: ["Read-only assigned-property access", "Dashboards and reports", "No operational changes"],
  };
  return summaries[role];
}

export class TeamAccessPolicyError extends Error {
  constructor(
    readonly code:
      | "FORBIDDEN"
      | "INVALID_PROPERTY_SCOPE"
      | "FINAL_OWNER"
      | "SELF_ESCALATION"
      | "OWNER_RESERVED"
      | "INACTIVE_MEMBERSHIP"
      | "INVITATION_EXPIRED"
      | "INVITATION_CANCELLED"
      | "INVITATION_REPLAYED"
      | "DUPLICATE_ACCESS",
    message: string,
  ) {
    super(message);
    this.name = "TeamAccessPolicyError";
  }
}

export function assertRoleAssignmentAllowed(input: Readonly<{
  actorProfileId: string;
  actorRole: WorkspaceRole;
  targetProfileId?: string;
  currentRole?: WorkspaceRole;
  nextRole: WorkspaceRole;
  activeOwnerCount: number;
}>) {
  if (!["owner", "administrator"].includes(input.actorRole)) {
    throw new TeamAccessPolicyError("FORBIDDEN", "Only owners and administrators can manage roles.");
  }
  if (input.actorRole === "administrator" && input.nextRole === "owner") {
    throw new TeamAccessPolicyError("OWNER_RESERVED", "Administrators cannot grant Owner access.");
  }
  if (input.nextRole === "owner" && input.currentRole !== "owner") {
    throw new TeamAccessPolicyError(
      "OWNER_RESERVED",
      "Granting Owner access requires the reserved ownership workflow.",
    );
  }
  if (
    input.targetProfileId === input.actorProfileId &&
    input.currentRole &&
    input.nextRole !== input.currentRole
  ) {
    throw new TeamAccessPolicyError("SELF_ESCALATION", "Members cannot change their own role.");
  }
  if (
    input.currentRole === "owner" &&
    input.nextRole !== "owner" &&
    input.activeOwnerCount <= 1
  ) {
    throw new TeamAccessPolicyError("FINAL_OWNER", "The final active Owner cannot be demoted.");
  }
}

export function normalizeInvitationEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new TeamAccessPolicyError("FORBIDDEN", "Enter a valid invitation email.");
  }
  return email;
}

export function invitationExpired(expiresAt: string, now = new Date()) {
  return Date.parse(expiresAt) <= now.getTime();
}
