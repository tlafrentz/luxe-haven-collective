import { describe, expect, it } from "vitest";
import { aggregateProcurementLines, canTransitionProcurement, classifyAvailability, classifyPriceChange, reconcileProcurementBudget, reconcileQuantity, substitutionRequirement, validateDeliveryWindow } from "./procurement-readiness";
const line = { productVersionId: "v", retailerId: "r", sku: "s", variant: "oak", currency: "USD", fulfillmentMethod: "ship", destinationKey: "p", requiredDate: null, quantity: 2, sourceSelectionId: "a", baselineUnitPriceMinor: 10000, currentUnitPriceMinor: 10000, deliveryMinor: 0, taxMinor: 0, assemblyMinor: 0, installationMinor: 0, availability: "available", required: true };
describe("FS-UX-006 procurement readiness", () => {
  it("governs lifecycle without order states", () => { expect(canTransitionProcurement("in_review", "approved")).toBe(true); expect(canTransitionProcurement("approved", "ordered")).toBe(false); });
  it("aggregates deterministically and preserves allocations", () => expect(aggregateProcurementLines([line, { ...line, sourceSelectionId: "b", quantity: 3 }])[0]).toMatchObject({ quantity: 5, sourceSelectionIds: ["a", "b"] }));
  it("rejects duplicate source allocation", () => expect(() => aggregateProcurementLines([line, line])).toThrow("DUPLICATE_SOURCE_ALLOCATION"));
  it("reconciles quantities exactly", () => { expect(reconcileQuantity(4, 4, [1, 3]).reconciled).toBe(true); expect(reconcileQuantity(4, 3, [3]).difference).toBe(-1); });
  it("classifies price and availability evidence", () => { expect(classifyPriceChange(10000, 12000).decision).toBe("reapproval_required"); expect(classifyAvailability("unknown", true)).toBe("blocking"); });
  it("reconciles fixed-minor-unit budgets", () => expect(reconcileProcurementBudget({ productMinor: 10000, deliveryMinor: 1000, taxMinor: 500, assemblyMinor: 0, installationMinor: 0, approvedTotalMinor: 11000, contingencyMinor: 1000 })).toMatchObject({ currentTotalMinor: 11500, varianceMinor: 500, outcome: "within_approved_contingency" }));
  it("validates delivery and substitutions", () => { expect(validateDeliveryWindow(null, null, null)[0].severity).toBe("blocking"); expect(substitutionRequirement({ designApprovedAlternative: false, sameProductVersion: false, tvMountCompatible: true, measurementCompatible: true })).toBe("design_revision_required"); });
});
