import { describe, expect, it, vi } from "vitest";

import {
  TeamAccessPolicyError,
  permissionsForRole,
  type WorkspaceAccessContext,
  type WorkspaceInvitation,
  type WorkspaceMembership,
} from "../domain";
import {
  changeWorkspaceMemberRole,
  getAccessSummary,
  inviteWorkspaceMember,
  resolveWorkspaceAccessContext,
  type TeamAccessRepository,
} from "./team-access-services";

const ownerContext: WorkspaceAccessContext = {
  profileId: "owner-profile", workspaceId: "workspace-1", ownerId: "workspace-1",
  ownerProfileId: "owner-profile", membershipId: "member-owner", role: "owner",
  status: "active", propertyAccess: { type: "all" }, permissions: permissionsForRole("owner"),
};
const owner: WorkspaceMembership = {
  id: "member-owner", workspaceId: "workspace-1", profileId: "owner-profile",
  role: "owner", status: "active", propertyAccess: { type: "all" },
  joinedAt: "2026-07-25T00:00:00Z", createdAt: "2026-07-25T00:00:00Z",
  updatedAt: "2026-07-25T00:00:00Z", member: { displayName: "Owner", email: "owner@example.com" },
};

function fake(): TeamAccessRepository {
  return {
    resolve: vi.fn(async () => ownerContext),
    members: vi.fn(async () => [owner]),
    invitations: vi.fn(async () => []),
    activity: vi.fn(async () => []),
    properties: vi.fn(async () => []),
    invite: vi.fn(async (input): Promise<WorkspaceInvitation> => ({
      id: "invite-1", workspaceId: input.context.workspaceId, email: input.email,
      role: input.role, status: "pending", propertyAccess: input.scope,
      invitedByProfileId: input.context.profileId, expiresAt: input.expiresAt,
      createdAt: "2026-07-25T00:00:00Z", updatedAt: "2026-07-25T00:00:00Z",
    })),
    resend: vi.fn(async () => { throw new Error("unused"); }),
    cancel: vi.fn(async () => undefined),
    accept: vi.fn(async () => ownerContext),
    changeRole: vi.fn(async () => undefined),
    changePropertyAccess: vi.fn(async () => undefined),
    changeStatus: vi.fn(async () => undefined),
  };
}

describe("Team access application services", () => {
  it("resolves only an active membership", async () => {
    await expect(resolveWorkspaceAccessContext(fake(), "owner-profile")).resolves.toEqual(ownerContext);
    await expect(resolveWorkspaceAccessContext({ ...fake(), resolve: async () => ({ ...ownerContext, status: "suspended" }) }, "owner-profile")).rejects.toBeInstanceOf(TeamAccessPolicyError);
  });

  it("treats the workspace context sentinel as the current membership", async () => {
    const repository = fake();
    await expect(resolveWorkspaceAccessContext(repository, "owner-profile", "current")).resolves.toEqual(ownerContext);
    expect(repository.resolve).toHaveBeenCalledWith("owner-profile", undefined);
  });

  it("allows an owner to invite a normalized least-privilege member", async () => {
    const invitation = await inviteWorkspaceMember(fake(), ownerContext, {
      email: " Ops@Example.com ", role: "operator",
      scope: { type: "selected", propertyIds: ["property-1"] },
      tokenHash: "hash", expiresAt: "2026-08-01T00:00:00Z", commandId: "command-1",
    });
    expect(invitation.email).toBe("ops@example.com");
    expect(invitation.propertyAccess).toEqual({ type: "selected", propertyIds: ["property-1"] });
  });

  it("denies invitation to an operator", async () => {
    await expect(inviteWorkspaceMember(fake(), { ...ownerContext, role: "operator", permissions: permissionsForRole("operator") }, {
      email: "person@example.com", role: "viewer", scope: { type: "none" },
      tokenHash: "hash", expiresAt: "2026-08-01T00:00:00Z", commandId: "command-1",
    })).rejects.toBeInstanceOf(TeamAccessPolicyError);
  });

  it("enforces final-owner safeguard before persistence", async () => {
    await expect(changeWorkspaceMemberRole(fake(), ownerContext, [owner], owner.id, "administrator", "command-1")).rejects.toBeInstanceOf(TeamAccessPolicyError);
  });

  it("builds operational access summaries", () => {
    expect(getAccessSummary([owner, { ...owner, id: "viewer", profileId: "viewer", role: "viewer", propertyAccess: { type: "none" } }], [])).toEqual({
      activeMembers: 2, pendingInvitations: 0, administrators: 1, restrictedMembers: 1,
    });
  });
});
