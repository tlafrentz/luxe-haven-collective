import { describe, expect, it } from "vitest";

import {
  WorkspaceAccessError,
  type OrganizationProfile,
  type WorkspaceIdentity,
} from "../domain";
import {
  getOrganizationProfile,
  updateOrganizationProfile,
  type OrganizationRepository,
} from "./organization-services";

const identity: WorkspaceIdentity = {
  profileId: "profile-1",
  ownerId: "owner-1",
  workspaceId: "owner-1",
};
const principal = {
  profileId: "profile-1",
  role: "owner" as const,
  displayName: "Todd",
};
const profile: OrganizationProfile = {
  ...identity,
  displayName: "Luxe Haven",
  timezone: "America/Phoenix",
  currency: "USD",
  language: "en-US",
  country: "US",
  confirmedFields: [],
  completeness: {
    status: "incomplete",
    missingRequired: ["Timezone"],
    missingRecommended: [],
    dimensions: { identity: false, contact: false, regionalDefaults: false, brand: false },
  },
  revision: 1,
  updatedAt: "2026-07-25T09:00:00Z",
};
const changes = {
  displayName: "Luxe Haven",
  timezone: "America/Phoenix",
  currency: "USD",
  language: "en-US",
  country: "US",
};

function repository(): OrganizationRepository {
  return {
    get: async () => profile,
    update: async () => ({ ...profile, revision: 2, legalName: "Luxe Haven LLC" }),
    activity: async () => [],
  };
}

describe("Organization application services", () => {
  it("gets the organization through the canonical workspace identity", async () => {
    await expect(
      getOrganizationProfile(repository(), principal, identity),
    ).resolves.toEqual(profile);
  });

  it("updates an authorized organization and preserves optional projection fields", async () => {
    const updated = await updateOrganizationProfile(
      repository(),
      principal,
      identity,
      { changes, expectedRevision: 1, idempotencyKey: "command-123" },
    );
    expect(updated.legalName).toBe("Luxe Haven LLC");
    expect(updated.revision).toBe(2);
  });

  it("rejects unauthorized updates", async () => {
    await expect(
      updateOrganizationProfile(
        repository(),
        { ...principal, role: "cleaner" },
        identity,
        { changes, expectedRevision: 1, idempotencyKey: "command-123" },
      ),
    ).rejects.toBeInstanceOf(WorkspaceAccessError);
  });

  it("prevents cross-workspace access before calling persistence", async () => {
    await expect(
      getOrganizationProfile(
        repository(),
        principal,
        { ...identity, profileId: "profile-2" },
      ),
    ).rejects.toBeInstanceOf(WorkspaceAccessError);
  });
});
