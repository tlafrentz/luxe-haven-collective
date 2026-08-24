import { describe, expect, it } from "vitest";
import { resolveFurnishingActivation } from "@/features/furnishing-studio/activation";

describe("FS-008A P2.1 entitlement boundary", () => {
  it("denies initial grant, replay, retry, reactivation, repair, and backfill through the canonical policy", () => {
    for (const path of ["checkout/payment-success", "initial-grant", "payment-replay", "retry", "manual-admin", "repair", "backfill", "subscription-change"]) {
      const decision = resolveFurnishingActivation({ globalKillSwitch: true, globalState: "disabled", workspaceKillSwitch: false, workspaceEnabled: false, cohortEligible: false, capabilityEnabled: false, configurationValid: true, policyVersion: "fs008a-v1" });
      expect(decision.allowed, path).toBe(false);
      expect(decision.reason, path).toBe("killed_globally");
    }
  });
  it("does not deny unrelated capabilities", () => {
    expect("guidebook.project.access".startsWith("furnishing.")).toBe(false);
    expect("hpm.workspace.access".startsWith("furnishing.")).toBe(false);
  });
});
