import type { OperationalSurfaceProjection } from "@/features/operational-surfaces";

import {
  WorkspaceAccessError,
  canAdministerWorkspace,
  workspaceAccessFor,
  type WorkspaceIdentity,
  type WorkspacePrincipal,
  type WorkspaceSummary,
} from "../domain/workspace";
import type { OrganizationProfile } from "../domain/organization";

export type ResolvedWorkspaceIdentity = Readonly<{
  profileId: string;
  ownerId: string | null;
  workspaceId: string | null;
}>;

export interface WorkspaceRepository {
  resolveIdentity(profileId: string): Promise<ResolvedWorkspaceIdentity>;
  initializeOwner(profileId: string): Promise<WorkspaceIdentity>;
  getOperationalProjection(
    identity: WorkspaceIdentity,
    workspaceLabel: string,
  ): Promise<OperationalSurfaceProjection>;
}

export async function resolveWorkspaceIdentity(
  repository: WorkspaceRepository,
  principal: WorkspacePrincipal,
): Promise<ResolvedWorkspaceIdentity> {
  const identity = await repository.resolveIdentity(principal.profileId);
  if (identity.profileId !== principal.profileId) {
    throw new WorkspaceAccessError("The requested workspace is not accessible.");
  }
  return identity;
}

export async function initializeWorkspaceOwner(
  repository: WorkspaceRepository,
  principal: WorkspacePrincipal,
): Promise<WorkspaceIdentity> {
  if (!canAdministerWorkspace(principal.role)) throw new WorkspaceAccessError();
  const identity = await repository.initializeOwner(principal.profileId);
  if (identity.profileId !== principal.profileId) {
    throw new WorkspaceAccessError("The initialized workspace is not accessible.");
  }
  return identity;
}

function workspaceLabel(principal: WorkspacePrincipal): string {
  return principal.displayName
    ? `${principal.displayName}'s Workspace`
    : "Hospitality Workspace";
}

export async function getWorkspaceOverview(
  repository: WorkspaceRepository,
  principal: WorkspacePrincipal,
  identity: WorkspaceIdentity,
  organization?: OrganizationProfile,
  team?: Readonly<{
    memberCount: number;
    ownerCount: number;
    pendingInvitationCount: number;
    restrictedMemberCount: number;
  }>,
  personalSettings?: Readonly<{
    notificationsConfirmed: boolean;
    preferencesInitialized: boolean;
  }>,
): Promise<WorkspaceSummary> {
  if (identity.profileId !== principal.profileId) {
    throw new WorkspaceAccessError("The requested workspace is not accessible.");
  }
  const operations = await repository.getOperationalProjection(
    identity,
    workspaceLabel(principal),
  );
  const connected = operations.properties.filter(
    ({ property }) => property.connectionState === "connected",
  ).length;
  const organizationName = organization?.displayName ?? principal.displayName;
  const organizationConfigured = organization
    ? organization.completeness.missingRequired.length === 0
    : Boolean(principal.displayName?.trim());
  const providerConnected =
    operations.synchronization.status !== "never-run" &&
    operations.synchronization.recommendedAction !==
      "Reconnect the source in Workspace.";
  const setupItems = [
    ...(!organizationConfigured ? ["Add your organization identity"] : []),
    ...(operations.properties.length === 0 ? ["Import your first property"] : []),
    ...(!providerConnected ? ["Connect your hospitality platform"] : []),
    ...(!operations.synchronization.lastSuccessfulAt
      ? ["Complete the first synchronization"]
      : []),
    ...(!personalSettings?.notificationsConfirmed ? ["Configure notifications"] : []),
    ...(!personalSettings?.preferencesInitialized ? ["Review workspace preferences"] : []),
  ];
  const degraded = (
    operations.contexts.length > 0 &&
    ["degraded", "unusable"].includes(operations.quality.status)
  )
    || operations.synchronization.status === "partially-succeeded"
    || (
      operations.synchronization.status === "failed" &&
      (
        operations.synchronization.failed.records > 0 ||
        operations.properties.length > 0 ||
        Boolean(operations.synchronization.lastSuccessfulAt)
      )
    );
  return Object.freeze({
    identity,
    organization: {
      name: organizationName,
      configured: organizationConfigured,
    },
    team: {
      memberCount: team?.memberCount ?? 1,
      ownerCount: team?.ownerCount ?? 1,
      pendingInvitationCount: team?.pendingInvitationCount ?? 0,
      restrictedMemberCount: team?.restrictedMemberCount ?? 0,
      currentUserAccess: workspaceAccessFor(principal.role),
    },
    properties: { total: operations.properties.length, connected },
    connection: {
      provider: operations.providerLabel,
      connected: providerConnected,
      status: operations.synchronization.status,
      lastSuccessfulAt: operations.synchronization.lastSuccessfulAt,
    },
    notifications: { configured: personalSettings?.notificationsConfirmed ?? false },
    preferences: { configured: personalSettings?.preferencesInitialized ?? false },
    health: {
      state: degraded
        ? "degraded"
        : setupItems.length
          ? "setup-required"
          : "healthy",
      synchronization: operations.synchronization.status,
      operationalData: operations.quality.status,
      setupItems,
      setupCompleted: 6 - setupItems.length,
      setupTotal: 6,
    },
  });
}

export async function getWorkspaceHealth(
  repository: WorkspaceRepository,
  principal: WorkspacePrincipal,
  identity: WorkspaceIdentity,
) {
  return (await getWorkspaceOverview(repository, principal, identity)).health;
}

export const workspaceNavigation = Object.freeze([
  { id: "overview", label: "Overview", href: "/dashboard/workspace" },
  { id: "health", label: "Health & Setup", href: "/dashboard/workspace/health" },
  { id: "organization", label: "Organization", href: "/dashboard/workspace/organization" },
  { id: "team", label: "Team & Access", href: "/dashboard/workspace/team" },
  { id: "properties", label: "Properties", href: "/dashboard/workspace/properties" },
  { id: "connected-systems", label: "Connected Systems", href: "/dashboard/workspace/connected-systems" },
  { id: "notifications", label: "Notifications", href: "/dashboard/workspace/notifications" },
  { id: "preferences", label: "Preferences", href: "/dashboard/workspace/preferences" },
] as const);

export function getWorkspaceNavigation() {
  return workspaceNavigation;
}
