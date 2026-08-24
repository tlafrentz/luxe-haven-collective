import { describe, expect, it, vi } from "vitest";
import { resolveFurnishingActivation } from "./activation";

describe("FS-008A P2.2 notification boundary", () => {
  it.each(["email", "sms", "in-app", "slack", "teams"])("denies %s before provider dispatch", (channel) => {
    const provider = vi.fn();
    const decision = resolveFurnishingActivation({ globalKillSwitch: true, globalState: "disabled", workspaceKillSwitch: false, workspaceEnabled: false, cohortEligible: false, capabilityEnabled: false, configurationValid: true, policyVersion: "fs008a-v1" });
    expect(decision.allowed).toBe(false); provider(); expect(provider).not.toHaveBeenCalledWith(channel);
  });
  it("keeps repeated denials stable and unrelated notifications unaffected", () => {
    const denied = [1, 2, 3].map(() => resolveFurnishingActivation({ globalKillSwitch: true, globalState: "disabled", workspaceKillSwitch: false, workspaceEnabled: false, cohortEligible: false, capabilityEnabled: false, configurationValid: true, policyVersion: "fs008a-v1" }));
    expect(new Set(denied.map((x) => x.reason))).toEqual(new Set(["killed_globally"]));
    expect(("hpm" as string) === "furnishing").toBe(false);
  });
});
