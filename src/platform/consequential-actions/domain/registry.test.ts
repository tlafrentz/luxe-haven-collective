import { describe, expect, it } from "vitest";
import { CONSEQUENTIAL_ACTION_REGISTRY } from "./registry";

describe("CONSEQUENTIAL_ACTION_REGISTRY", () => {
  it("gives every entry a non-empty source reference", () => {
    for (const entry of Object.values(CONSEQUENTIAL_ACTION_REGISTRY)) {
      expect(entry.sourceFiles.length).toBeGreaterThan(0);
    }
  });

  it("keys every entry's code to its own registry key", () => {
    for (const [key, entry] of Object.entries(CONSEQUENTIAL_ACTION_REGISTRY)) {
      expect(entry.code).toBe(key);
    }
  });

  it("never claims a live kill switch that doesn't exist yet", () => {
    // As of this registry's creation, no action anywhere in the codebase has
    // a live, togglable emergency switch -- if this ever flips, it should be
    // a deliberate, reviewed change (a real PA-008b), not a silent drift.
    for (const entry of Object.values(CONSEQUENTIAL_ACTION_REGISTRY)) {
      expect(entry.atomicBoundary.hasLiveKillSwitch).toBe(false);
    }
  });

  it("never marks a not-yet-implemented action as reconciling a provider result", () => {
    for (const entry of Object.values(CONSEQUENTIAL_ACTION_REGISTRY)) {
      if (entry.implementationStatus === "not_yet_implemented") {
        expect(entry.atomicBoundary.reconcilesProviderResult).toBe(false);
      }
    }
  });

  it("catalogs the SEP-004 candidates found during research", () => {
    expect(Object.keys(CONSEQUENTIAL_ACTION_REGISTRY)).toEqual([
      "STRIPE_PURCHASE",
      "STRIPE_REFUND",
      "PLAID_PROVIDER_DISCONNECT",
      "FURNISHING_PURCHASE_AUTHORIZATION",
      "REVENUE_RATE_PUBLICATION",
      "BULK_EMAIL_DIGEST",
    ]);
  });
});
