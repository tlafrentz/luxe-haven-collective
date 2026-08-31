import { describe, expect, it } from "vitest";
import { RELEASE_CAPABILITIES, capabilityLabel, confirmationLabel, contextualActionFor, prerequisiteFor, releaseSafetyState, rollbackBlocker, stateLabel, validateControlReason, type CapabilityProjection, type ReleaseContext } from "./release-controls";

const items: CapabilityProjection[] = RELEASE_CAPABILITIES.map((capability, index) => ({ capability, enabled: index < 1, verification: index < 1 ? "verified" : "unverified", version: 1 }));
const context: ReleaseContext = { cohortActive: true, suspended: false, policyCurrent: true, versionCurrent: true, workspaceValid: true, capabilities: items };

describe("FS-UX-008 release controls", () => {
  it("uses the governed sequence and human labels", () => expect(RELEASE_CAPABILITIES.map(capabilityLabel)).toEqual(["Catalog viewing", "Design Workspace", "Budgeting", "Procurement readiness"]));
  it("requires the preceding capability to be verified", () => { expect(prerequisiteFor("design_workspace", context)).toBeNull(); expect(prerequisiteFor("budgeting", context)).toContain("Design Workspace"); });
  it("selects one contextual action", () => { expect(contextualActionFor(items[0], context)).toBe("view"); expect(contextualActionFor(items[1], context)).toBe("enable"); expect(contextualActionFor(items[2], context)).toBeNull(); });
  it("enforces reverse rollback", () => expect(rollbackBlocker("catalog_viewing", [...items.slice(0, 2), { ...items[2], enabled: true }])).toContain("Budgeting"));
  it("presents protected and suspended states accurately", () => { expect(releaseSafetyState({ globalKillSwitch: true, suspended: false, recoveryRequired: false, available: true })).toBe("Protected"); expect(stateLabel(items[1], { ...context, suspended: true })).toBe("Suspended"); });
  it("validates reasons and contextual confirmation", () => { expect(validateControlReason("short")).toContain("12"); expect(validateControlReason("Controlled verification for catalog access")).toBeNull(); expect(confirmationLabel("enable", "catalog_viewing", "Luxe Haven Collective")).toBe("Enable Catalog viewing for Luxe Haven Collective"); });
});
