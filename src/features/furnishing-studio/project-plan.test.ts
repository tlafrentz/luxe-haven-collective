import { describe, expect, it } from "vitest";
import {
  budgetStatus,
  planProgress,
  purchaseQuantity,
  replaceSelection,
  selectionEstimate,
  validatePlan,
} from "./project-plan";
describe("FS-005 project plan", () => {
  it("accounts for partial existing inventory", () => {
    expect(purchaseQuantity(6, 4)).toBe(2);
    expect(
      selectionEstimate({
        resolvedQuantity: 6,
        existingQuantity: 4,
        unitPriceMinor: 5000,
      }),
    ).toBe(10000);
  });
  it("replaces product without mutating the source", () => {
    const current = {
      productId: "a",
      offerId: "o1",
      unitPriceMinor: 100,
      status: "selected",
    };
    expect(
      replaceSelection(current, {
        productId: "b",
        offerId: "o2",
        unitPriceMinor: 80,
      }),
    ).toMatchObject({ productId: "b", status: "replaced" });
    expect(current.productId).toBe("a");
  });
  it("uses deterministic budget bands", () => {
    expect(budgetStatus(9000, 10000)).toBe("on_track");
    expect(budgetStatus(9700, 10000)).toBe("near_budget");
    expect(budgetStatus(10001, 10000)).toBe("over_budget");
  });
  it("computes progress only from required resolved items", () =>
    expect(
      planProgress(
        [
          {
            id: "1",
            roomId: "r",
            required: true,
            productId: "p",
            resolvedQuantity: 1,
            existingQuantity: 0,
            unitPriceMinor: 1,
            selectionStatus: "selected",
          },
          {
            id: "2",
            roomId: "r",
            required: false,
            productId: null,
            resolvedQuantity: 1,
            existingQuantity: 0,
            unitPriceMinor: null,
            selectionStatus: "skipped_optional",
          },
        ],
        1,
      ),
    ).toEqual({ resolved: 1, requiredCount: 1, percent: 100 }));
  it("blocks missing required selections but warns on price and style", () => {
    const result = validatePlan({
      selections: [
        {
          id: "priced",
          roomId: "r",
          required: true,
          productId: "p",
          resolvedQuantity: 1,
          existingQuantity: 0,
          unitPriceMinor: null,
          selectionStatus: "selected",
          styleCompatibility: null,
        },
      ],
      requiredItemIds: ["missing", "priced"],
      roomIds: ["r"],
      roomsWithPackages: ["r"],
      targetBudgetMinor: 100,
    });
    expect(result.ready).toBe(false);
    expect(result.errors).toContain("Required item missing has no selection");
    expect(result.warnings).toContain("Selection priced has no price");
  });
});
