import {
  WorkspaceAccessError,
  canAdministerWorkspace,
  type WorkspaceIdentity,
  type WorkspacePrincipal,
} from "../domain/workspace";
import {
  evaluateOrganizationCompleteness,
  type OrganizationProfile,
  type OrganizationUpdate,
} from "../domain/organization";

export type OrganizationActivity = Readonly<{
  id: string;
  actorDisplayName: string;
  changedFields: readonly string[];
  updatedAt: string;
}>;

export interface OrganizationRepository {
  get(identity: WorkspaceIdentity, fallbackName: string): Promise<OrganizationProfile>;
  update(input: Readonly<{
    identity: WorkspaceIdentity;
    actorProfileId: string;
    changes: OrganizationUpdate;
    expectedRevision: number;
    idempotencyKey: string;
  }>): Promise<OrganizationProfile>;
  activity(identity: WorkspaceIdentity): Promise<readonly OrganizationActivity[]>;
}

function assertIdentity(principal: WorkspacePrincipal, identity: WorkspaceIdentity) {
  if (principal.profileId !== identity.profileId) {
    throw new WorkspaceAccessError("The requested organization is not accessible.");
  }
}

export async function getOrganizationProfile(
  repository: OrganizationRepository,
  principal: WorkspacePrincipal,
  identity: WorkspaceIdentity,
) {
  assertIdentity(principal, identity);
  return repository.get(
    identity,
    principal.displayName ?? principal.profileId.split("@")[0] ?? "Hospitality Business",
  );
}

export async function updateOrganizationProfile(
  repository: OrganizationRepository,
  principal: WorkspacePrincipal,
  identity: WorkspaceIdentity,
  command: Readonly<{
    changes: OrganizationUpdate;
    expectedRevision: number;
    idempotencyKey: string;
  }>,
) {
  assertIdentity(principal, identity);
  if (!canAdministerWorkspace(principal.role)) throw new WorkspaceAccessError();
  return repository.update({
    identity,
    actorProfileId: principal.profileId,
    ...command,
  });
}

export async function getOrganizationActivity(
  repository: OrganizationRepository,
  principal: WorkspacePrincipal,
  identity: WorkspaceIdentity,
) {
  assertIdentity(principal, identity);
  return repository.activity(identity);
}

export function projectOrganizationProfile(
  input: Omit<OrganizationProfile, "completeness">,
): OrganizationProfile {
  return Object.freeze({
    ...input,
    completeness: evaluateOrganizationCompleteness({ profile: input }),
  });
}
