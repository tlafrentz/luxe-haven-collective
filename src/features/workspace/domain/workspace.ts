import type { UserRole } from "@/types/database";

export type WorkspaceIdentity = Readonly<{
  profileId: string;
  ownerId: string;
  workspaceId: string;
}>;

export type WorkspaceAccess = "administrator" | "member" | "restricted";
export type WorkspaceState =
  | "first-use"
  | "healthy"
  | "setup-required"
  | "degraded"
  | "permission"
  | "error";

export type OrganizationSummary = Readonly<{
  name: string | null;
  configured: boolean;
}>;

export type TeamSummary = Readonly<{
  memberCount: number;
  ownerCount: number;
  pendingInvitationCount: number;
  restrictedMemberCount: number;
  currentUserAccess: WorkspaceAccess;
}>;

export type PropertySummary = Readonly<{
  total: number;
  connected: number;
}>;

export type ConnectionSummary = Readonly<{
  provider: string;
  connected: boolean;
  status: string;
  lastSuccessfulAt: string | null;
}>;

export type WorkspaceHealth = Readonly<{
  state: Exclude<WorkspaceState, "first-use" | "permission" | "error">;
  synchronization: string;
  operationalData: string;
  setupItems: readonly string[];
  setupCompleted: number;
  setupTotal: number;
}>;

export type NotificationSummary = Readonly<{ configured: boolean }>;
export type PreferenceSummary = Readonly<{ configured: boolean }>;

export type WorkspaceSummary = Readonly<{
  identity: WorkspaceIdentity;
  organization: OrganizationSummary;
  team: TeamSummary;
  properties: PropertySummary;
  connection: ConnectionSummary;
  notifications: NotificationSummary;
  preferences: PreferenceSummary;
  health: WorkspaceHealth;
}>;

export type WorkspacePrincipal = Readonly<{
  profileId: string;
  role: UserRole | "administrator" | "operator" | "contributor" | "viewer";
  displayName: string | null;
}>;

export class WorkspaceAccessError extends Error {
  constructor(message = "Workspace administration requires owner or administrator access.") {
    super(message);
    this.name = "WorkspaceAccessError";
  }
}

export function workspaceAccessFor(role: WorkspacePrincipal["role"]): WorkspaceAccess {
  if (role === "owner" || role === "admin" || role === "administrator") return "administrator";
  if (role === "cleaner" || role === "operator" || role === "contributor" || role === "viewer") return "member";
  return "restricted";
}

export function canAdministerWorkspace(role: WorkspacePrincipal["role"]): boolean {
  return workspaceAccessFor(role) === "administrator";
}
