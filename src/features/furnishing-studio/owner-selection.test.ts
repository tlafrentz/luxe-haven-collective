import { describe, expect, it } from "vitest";
import {
  boundedSelectionQuantity,
  ownerPlanProjection,
} from "./owner-selection";

describe("FS-008G-C8-B owner selection", () => {
  it("enforces fixed-one and bounded quantities", () => {
    expect(
      boundedSelectionQuantity(1, {
        kind: "fixed_one",
        minimum: 1,
        maximum: 1,
      }),
    ).toBe(1);
    expect(() =>
      boundedSelectionQuantity(2, {
        kind: "fixed_one",
        minimum: 1,
        maximum: 1,
      }),
    ).toThrow("SELECTION_QUANTITY_FIXED_ONE");
    expect(() =>
      boundedSelectionQuantity(6, { kind: "bounded", minimum: 1, maximum: 4 }),
    ).toThrow("SELECTION_QUANTITY_OUT_OF_BOUNDS");
  });

  it("projects customer-safe budget values without internal identifiers", () => {
    const result = ownerPlanProjection({
      status: "awaiting_approval",
      currency: "USD",
      selections: [
        {
          roomName: "Bedroom",
          productName: "Lamp",
          retailerName: "Retailer",
          quantity: 2,
          unitPriceMinor: 2500,
          deliveryMinor: 500,
          status: "selected",
        },
      ],
    });
    expect(result).toMatchObject({ subtotalMinor: 5000, deliveryMinor: 500 });
    expect(JSON.stringify(result)).not.toMatch(
      /audit|reason|correlation|idempotency|credential|hash|Id/,
    );
  });
});
