import { describe, expect, it } from "vitest";
import { adoptionEligibility, catalogActions, catalogAttentionPriority, catalogScopeLabel, serializeCatalogFilters } from "./catalog-ux";
describe("FS-UX-002 catalog policy", () => {
  it("translates scope without exposing implementation values", () => { expect(catalogScopeLabel("platform", "draft")).toBe("Platform library"); expect(catalogScopeLabel("workspace", "approved")).toBe("Approved"); });
  it("requires adoption before platform approval", () => { expect(catalogActions({ role: "admin", scope: "platform", status: "draft", controlledWorkspace: true })).toMatchObject({ canAdopt: true, canApprove: false }); });
  it("permits approval only for an in-review workspace target", () => { expect(catalogActions({ role: "admin", scope: "workspace", status: "in_review", controlledWorkspace: true }).canApprove).toBe(true); expect(catalogActions({ role: "admin", scope: "workspace", status: "draft", controlledWorkspace: true }).canApprove).toBe(false); });
  it("detects adoption duplicates and invalid targets", () => { expect(adoptionEligibility({ scope: "platform", workspaceId: null, status: "draft", existingWorkspaceProductId: "existing" })).toMatchObject({ eligible: false, code: "existing_match" }); expect(adoptionEligibility({ scope: "workspace", workspaceId: "w", status: "draft" }).eligible).toBe(false); });
  it("serializes only supported filters", () => { expect(serializeCatalogFilters({ q: " chair ", scope: "unsafe", status: "draft", page: "2" })).toBe("q=chair&status=draft&page=2"); });
  it("sorts blocking attention above missing information", () => { expect(catalogAttentionPriority(["duplicate candidate"])).toBeGreaterThan(catalogAttentionPriority(["missing image"])); });
});
