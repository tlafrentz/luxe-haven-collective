import { describe, expect, it } from "vitest";
import { resolveFurnishingActivation } from "./activation";

const base = { globalKillSwitch: false, globalState: "enabled" as const, workspaceKillSwitch: false, workspaceEnabled: true, cohortEligible: true, capabilityEnabled: true, actorRole: "owner" as const, tenantRelationship: "own" as const, configurationValid: true, policyVersion: "fs008a-v1" };
describe("FS-008A Furnishing activation policy", () => {
  it("fails closed by default and on invalid configuration", () => expect(resolveFurnishingActivation({ ...base, globalState: "disabled" }).reason).toBe("disabled_globally"));
  it("gives the global kill switch precedence", () => expect(resolveFurnishingActivation({ ...base, globalKillSwitch: true, capabilityEnabled: true }).reason).toBe("killed_globally"));
  it("gives workspace kill switch precedence over cohort and capability", () => expect(resolveFurnishingActivation({ ...base, workspaceKillSwitch: true }).reason).toBe("killed_globally"));
  it("denies expired cohorts, wrong tenants, inactive offers, and missing entitlements", () => {
    expect(resolveFurnishingActivation({ ...base, cohortExpired: true }).reason).toBe("cohort_expired");
    expect(resolveFurnishingActivation({ ...base, tenantRelationship: "wrong_tenant" }).reason).toBe("unauthorized");
    expect(resolveFurnishingActivation({ ...base, offerActive: false }).reason).toBe("offer_inactive");
    expect(resolveFurnishingActivation({ ...base, entitlementRequired: true, entitlementActive: false }).reason).toBe("entitlement_required");
  });
});
