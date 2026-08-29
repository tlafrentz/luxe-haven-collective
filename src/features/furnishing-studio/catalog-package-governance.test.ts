import { describe, expect, it } from "vitest";
import {
  internalCohortVisible,
  validateGovernedScope,
  validateOfferAssignments,
} from "./catalog-package-governance";

describe("FS-008G-C8-A catalog and package governance", () => {
  it("fails closed on malformed workspace scope", () => {
    expect(
      validateGovernedScope({ scope: "workspace", workspaceId: null }),
    ).toEqual(["Workspace scope requires a workspace"]);
    expect(
      validateGovernedScope({ scope: "platform", workspaceId: "w" }),
    ).toEqual(["Platform scope cannot name a workspace"]);
  });

  it("requires one controlled preferred offer and governed alternates", () => {
    expect(
      validateOfferAssignments("p", [
        {
          offerId: "a",
          role: "preferred",
          rank: 1,
          approvalStatus: "approved",
          offerStatus: "active",
          productId: "p",
        },
        {
          offerId: "b",
          role: "alternate",
          rank: 2,
          approvalStatus: "approved",
          offerStatus: "active",
          productId: "p",
        },
      ]),
    ).toEqual([]);
    expect(
      validateOfferAssignments("p", [
        {
          offerId: "a",
          role: "alternate",
          rank: 1,
          approvalStatus: "approved",
          offerStatus: "archived",
          productId: "other",
        },
      ]),
    ).toEqual([
      "Exactly one approved preferred offer is required",
      "Offer assignment product mismatch",
      "Assigned offers must be active",
    ]);
  });

  it("exposes governed data only through the exact internal cohort", () => {
    const eligible = {
      globalState: "internal",
      globalKillSwitch: false,
      configurationValid: true,
      workspaceEnabled: true,
      workspaceKillSwitch: false,
      cohort: "internal",
      revoked: false,
      catalogViewingEnabled: true,
    };
    expect(internalCohortVisible(eligible)).toBe(true);
    expect(internalCohortVisible({ ...eligible, cohort: "public" })).toBe(
      false,
    );
    expect(
      internalCohortVisible({ ...eligible, workspaceKillSwitch: true }),
    ).toBe(false);
  });
});
