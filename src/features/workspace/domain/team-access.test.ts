import { describe, expect, it } from "vitest";

import {
  TeamAccessPolicyError,
  assertRoleAssignmentAllowed,
  capabilitySummary,
  evaluatePropertyAccess,
  evaluateWorkspacePermission,
  invitationExpired,
  normalizeInvitationEmail,
  normalizePropertyAccess,
  permissionsForRole,
  workspaceRolePermissions,
  type WorkspaceAccessContext,
  type WorkspaceRole,
} from "./team-access";

function context(role: WorkspaceRole, status: WorkspaceAccessContext["status"] = "active"): WorkspaceAccessContext {
  return {
    profileId: "profile-1",
    workspaceId: "workspace-1",
    ownerId: "workspace-1",
    ownerProfileId: "owner-profile",
    membershipId: "membership-1",
    role,
    status,
    propertyAccess: role === "owner" ? { type: "all" } : { type: "selected", propertyIds: ["property-1"] },
    permissions: permissionsForRole(role),
  };
}

describe("workspace role policy v1", () => {
  it("defines all five roles through one canonical matrix", () => {
    expect(Object.keys(workspaceRolePermissions)).toEqual([
      "owner", "administrator", "operator", "contributor", "viewer",
    ]);
    expect(permissionsForRole("owner").has("team.manage_roles")).toBe(true);
    expect(permissionsForRole("operator").has("team.invite")).toBe(false);
    expect(permissionsForRole("viewer").has("bookings.operate")).toBe(false);
  });

  it("requires active membership before granting a role capability", () => {
    expect(evaluateWorkspacePermission(context("operator"), "bookings.view")).toBe(true);
    expect(evaluateWorkspacePermission(context("operator", "suspended"), "bookings.view")).toBe(false);
    expect(evaluateWorkspacePermission(context("viewer", "removed"), "reports.view")).toBe(false);
  });

  it("evaluates all, selected, and none property scope independently from role", () => {
    expect(evaluatePropertyAccess(context("owner"), "anything")).toBe(true);
    expect(evaluatePropertyAccess(context("operator"), "property-1")).toBe(true);
    expect(evaluatePropertyAccess(context("operator"), "property-2")).toBe(false);
    expect(evaluatePropertyAccess({ ...context("viewer"), propertyAccess: { type: "none" } }, "property-1")).toBe(false);
  });

  it("forces owners and administrators to all properties and rejects empty selected scope", () => {
    expect(normalizePropertyAccess("owner", { type: "none" })).toEqual({ type: "all" });
    expect(normalizePropertyAccess("administrator", { type: "selected", propertyIds: ["x"] })).toEqual({ type: "all" });
    expect(() => normalizePropertyAccess("operator", { type: "selected", propertyIds: [] })).toThrow(TeamAccessPolicyError);
  });

  it("protects the final owner, self role changes, and Owner assignment by administrators", () => {
    expect(() => assertRoleAssignmentAllowed({
      actorProfileId: "owner-1", actorRole: "owner", targetProfileId: "owner-2",
      currentRole: "owner", nextRole: "administrator", activeOwnerCount: 1,
    })).toThrowError(/final active Owner/);
    expect(() => assertRoleAssignmentAllowed({
      actorProfileId: "admin", actorRole: "administrator", targetProfileId: "member",
      currentRole: "operator", nextRole: "owner", activeOwnerCount: 1,
    })).toThrowError(/cannot grant Owner/);
    expect(() => assertRoleAssignmentAllowed({
      actorProfileId: "member", actorRole: "owner", targetProfileId: "member",
      currentRole: "administrator", nextRole: "viewer", activeOwnerCount: 2,
    })).toThrowError(/own role/);
  });

  it("normalizes invitation email, evaluates expiry, and provides understandable summaries", () => {
    expect(normalizeInvitationEmail(" Operations@Example.COM ")).toBe("operations@example.com");
    expect(() => normalizeInvitationEmail("bad")).toThrow(TeamAccessPolicyError);
    expect(invitationExpired("2026-07-24T00:00:00Z", new Date("2026-07-25T00:00:00Z"))).toBe(true);
    expect(capabilitySummary("contributor")).toContain("No workspace administration");
  });
});
