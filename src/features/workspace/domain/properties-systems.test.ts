import { describe, expect, it } from "vitest";
import { buildPropertiesAndSystemsHealth, evaluatePropertyOperationalReadiness, mapConnectedSystemStatus, potentialMatchAllowed } from "./properties-systems";

describe("workspace properties and connected systems policy", () => {
  it("keeps provider linkage separate from canonical status", () => {
    expect(evaluatePropertyOperationalReadiness({ canonicalStatus: "active", inclusion: "included", linkage: "unlinked", syncStatus: "succeeded", qualityStatus: "trusted", timezone: "America/Phoenix" })).toBe("setup-required");
    expect(evaluatePropertyOperationalReadiness({ canonicalStatus: "active", inclusion: "included", linkage: "disconnected", syncStatus: "failed", qualityStatus: "degraded", timezone: "America/Phoenix" })).toBe("degraded");
  });

  it("does not approve weak similarity as a match", () => {
    expect(potentialMatchAllowed({ explicitConfirmation: true })).toBe(false);
    expect(potentialMatchAllowed({ stableExternalId: "provider-1", explicitConfirmation: true })).toBe(true);
  });

  it("maps connection and partial linkage health", () => {
    expect(mapConnectedSystemStatus({ connectionStatus: "active", syncStatus: "running", linked: 1, discovered: 1 })).toBe("syncing");
    expect(mapConnectedSystemStatus({ connectionStatus: "active", syncStatus: "completed", linked: 1, discovered: 2 })).toBe("attention-needed");
  });

  it("treats an empty workspace as setup, not an error", () => {
    expect(buildPropertiesAndSystemsHealth([], []).state).toBe("setup-required");
  });
});
