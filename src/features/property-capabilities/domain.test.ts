import { describe, expect, it } from "vitest";
import {
  calculateGuidebookCoverage,
  evaluateHpmUpgrade,
  listGuidebookEligibleProperties,
  scopePropertiesByCapability,
  validateGuidebookPropertyInput,
  type CapabilityProperty,
} from "./domain";

const properties: CapabilityProperty[] = [
  { id: "guidebook", capabilities: [{ capability: "guidebook", status: "enabled" }] },
  { id: "hpm", capabilities: [{ capability: "hpm", status: "enabled" }] },
  { id: "both", capabilities: [{ capability: "guidebook", status: "enabled" }, { capability: "hpm", status: "enabled" }] },
  { id: "disabled", capabilities: [{ capability: "guidebook", status: "disabled" }] },
];

describe("property capabilities", () => {
  it("validates the smaller Guidebook profile without requiring an address", () => {
    expect(validateGuidebookPropertyInput({
      workspaceId: "workspace", name: "Mesa", propertyType: "home", city: "Mesa",
      state: "Arizona", country: "US", timezone: "America/Phoenix", maxGuests: 8,
    })).toEqual({ valid: true, fields: [] });
  });

  it("rejects invalid capacity and timezone", () => {
    const result = validateGuidebookPropertyInput({
      workspaceId: "workspace", name: "Mesa", propertyType: "home", city: "Mesa",
      state: "Arizona", country: "US", timezone: "Arizona", maxGuests: 0,
    });
    expect(result.valid).toBe(false);
    expect(result.fields).toEqual(expect.arrayContaining(["timezone", "maxGuests"]));
  });

  it("keeps Guidebook and HPM scopes independent", () => {
    expect(scopePropertiesByCapability(properties, "guidebook").map((p) => p.id)).toEqual(["guidebook", "both"]);
    expect(scopePropertiesByCapability(properties, "hpm").map((p) => p.id)).toEqual(["hpm", "both"]);
    expect(listGuidebookEligibleProperties(properties).map((p) => p.id)).toEqual(["guidebook", "hpm", "both"]);
  });

  it("calculates coverage only from Guidebook-enabled properties", () => {
    expect(calculateGuidebookCoverage(properties, new Set(["guidebook", "hpm"]))).toEqual({ eligible: 2, published: 1, percentage: 50 });
  });

  it("offers HPM as an additive upgrade", () => {
    expect(evaluateHpmUpgrade(properties[0])).toEqual({ eligible: true, reason: "available" });
    expect(evaluateHpmUpgrade(properties[1])).toEqual({ eligible: false, reason: "already-enabled" });
  });
});
