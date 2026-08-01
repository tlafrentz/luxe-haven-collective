import { describe, expect, it } from "vitest";

import { projectGuidebookEntitlements } from "@/features/guidebook-studio";
import {
  resolveEntitlements,
  type CommerceEntitlementGrant,
} from ".";

const now = new Date("2026-07-31T12:00:00Z");
const workspaceId = "bb190b81-88fd-45a4-bd89-ddd05c12faba";
const propertyId = "11dff16c-1b9b-45c0-826e-4242931e86d0";
const profileId = "2351378c-7f59-4b7c-98ea-85f845b594d3";

function grant(
  key: string,
  scope: "workspace" | "property",
  overrides: Partial<CommerceEntitlementGrant> = {},
): CommerceEntitlementGrant {
  return {
    id: `grant-${key}`,
    entitlementTemplateId: `template-${key}`,
    entitlementKey: key,
    scopeType: scope,
    ...(scope === "workspace" ? { workspaceId } : { propertyId }),
    sourceType: "manual",
    sourceId: `source-${key}`,
    status: "active",
    effectiveFrom: new Date("2026-07-01T00:00:00Z"),
    revision: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("Guidebook Commerce entitlement resolution", () => {
  it("resolves create for the workspace and publish/host for the selected property", () => {
    const resolved = resolveEntitlements({
      grants: [
        grant("guidebooks.create", "workspace"),
        grant("guidebooks.publish", "property"),
        grant("guidebooks.host", "property"),
      ],
      requestedKeys: ["guidebooks.create", "guidebooks.publish", "guidebooks.host"],
      workspaceId,
      propertyId,
      profileId,
      evaluatedAt: now,
    });

    expect(projectGuidebookEntitlements(resolved.entitlements)).toEqual({
      create: true,
      publish: true,
      host: true,
    });
  });

  it("does not resolve property grants for a different property", () => {
    const resolved = resolveEntitlements({
      grants: [grant("guidebooks.publish", "property"), grant("guidebooks.host", "property")],
      requestedKeys: ["guidebooks.publish", "guidebooks.host"],
      workspaceId,
      propertyId: "different-property",
      profileId,
      evaluatedAt: now,
    });
    expect(projectGuidebookEntitlements(resolved.entitlements)).toMatchObject({
      publish: false,
      host: false,
    });
  });

  it.each([
    ["expired", { status: "expired" as const }],
    ["suspended", { status: "suspended" as const }],
    ["revoked", { status: "revoked" as const }],
    ["future-effective", { effectiveFrom: new Date("2026-08-01T00:00:00Z") }],
  ])("does not resolve a %s grant", (_label, overrides) => {
    const resolved = resolveEntitlements({
      grants: [grant("guidebooks.create", "workspace", overrides)],
      requestedKeys: ["guidebooks.create"],
      workspaceId,
      profileId,
      evaluatedAt: now,
    });
    expect(projectGuidebookEntitlements(resolved.entitlements).create).toBe(false);
  });
});
