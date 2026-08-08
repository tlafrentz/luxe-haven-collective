import { describe, expect, it } from "vitest";
import {
  estimatePackage,
  resolveComposition,
  validateRoomPackage,
} from "./packages";
import { resolveQuantity } from "./schema";

const facts = { bedrooms: 3, bathrooms: 2, guests: 8, rooms: 8, beds: 3 };
describe("FS-003 package intelligence", () => {
  it("resolves explicit quantity rules", () => {
    expect(
      resolveQuantity(
        {
          id: "r",
          ruleType: "per_bedroom",
          multiplier: 2,
          minimum: null,
          maximum: null,
          customExpression: null,
          rounding: "none",
        },
        facts,
      ),
    ).toBe(6);
    expect(
      resolveQuantity(
        {
          id: "r",
          ruleType: "per_guest",
          multiplier: 1,
          minimum: 4,
          maximum: 6,
          customExpression: null,
          rounding: "up",
        },
        facts,
      ),
    ).toBe(6);
  });
  it("uses purchase-pack semantics and never prices missing values as zero", () => {
    expect(
      estimatePackage([
        { quantity: 12, unitPriceMinor: 3000, unitsPerPurchase: 6 },
        { quantity: 1, unitPriceMinor: null },
      ]),
    ).toEqual({
      estimatedTotalMinor: 6000,
      priced: 1,
      missingPrice: 1,
      coveragePercent: 50,
    });
  });
  it("resolves deterministic property composition", () => {
    expect(
      resolveComposition({ kind: "bedrooms_minus", value: 1 }, facts),
    ).toBe(2);
    expect(resolveComposition({ kind: "per_bathroom", value: 1 }, facts)).toBe(
      2,
    );
  });
  it("reports deterministic blocking package issues", () => {
    expect(
      validateRoomPackage([
        {
          requirementId: "bed",
          priority: "required",
          quantityRuleId: null,
          productId: null,
        },
      ]),
    ).toEqual([
      "Missing quantity rule",
      "Required requirement missing product",
    ]);
  });
});
