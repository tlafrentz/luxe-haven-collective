import {
  describe,
  expect,
  it,
} from "vitest";

import {
  calculateRevenueProjection,
} from "./calculate-revenue-projection";

describe("calculateRevenueProjection", () => {
  it("calculates monthly and annual revenue from ADR and occupancy", () => {
    const result =
      calculateRevenueProjection({
        projectedAdr: {
          amount: 200,
          currency: "USD",
        },
        projectedOccupancy: {
          value: 75,
        },
        confidence: {
          value: 85,
        },
      });

    expect(result).toEqual({
      projectedAdr: {
        amount: 200,
        currency: "USD",
      },
      projectedOccupancy: {
        value: 75,
      },
      projectedMonthlyRevenue: {
        amount: 4562.5,
        currency: "USD",
      },
      projectedAnnualRevenue: {
        amount: 54750,
        currency: "USD",
      },
      confidence: {
        value: 85,
      },
    });
  });

  it("supports a custom number of available nights", () => {
    const result =
      calculateRevenueProjection({
        projectedAdr: {
          amount: 150,
          currency: "USD",
        },
        projectedOccupancy: {
          value: 80,
        },
        confidence: {
          value: 90,
        },
        availableNights: 300,
      });

    expect(
      result.projectedAnnualRevenue,
    ).toEqual({
      amount: 36000,
      currency: "USD",
    });

    expect(
      result.projectedMonthlyRevenue,
    ).toEqual({
      amount: 3000,
      currency: "USD",
    });
  });

  it("returns zero revenue at zero occupancy", () => {
    const result =
      calculateRevenueProjection({
        projectedAdr: {
          amount: 250,
          currency: "USD",
        },
        projectedOccupancy: {
          value: 0,
        },
        confidence: {
          value: 70,
        },
      });

    expect(
      result.projectedAnnualRevenue.amount,
    ).toBe(0);

    expect(
      result.projectedMonthlyRevenue.amount,
    ).toBe(0);
  });

  it.each([
    -1,
    101,
  ])(
    "rejects occupancy outside the 0 to 100 range: %s",
    (value) => {
      expect(() =>
        calculateRevenueProjection({
          projectedAdr: {
            amount: 200,
            currency: "USD",
          },
          projectedOccupancy: {
            value,
          },
          confidence: {
            value: 80,
          },
        }),
      ).toThrow(
        "Projected occupancy must be between 0 and 100.",
      );
    },
  );

  it("rejects a negative ADR", () => {
    expect(() =>
      calculateRevenueProjection({
        projectedAdr: {
          amount: -100,
          currency: "USD",
        },
        projectedOccupancy: {
          value: 70,
        },
        confidence: {
          value: 80,
        },
      }),
    ).toThrow(
      "Projected ADR must be a finite, non-negative number.",
    );
  });

  it("rejects fractional available nights", () => {
    expect(() =>
      calculateRevenueProjection({
        projectedAdr: {
          amount: 200,
          currency: "USD",
        },
        projectedOccupancy: {
          value: 70,
        },
        confidence: {
          value: 80,
        },
        availableNights: 364.5,
      }),
    ).toThrow(
      "Available nights must be a whole number.",
    );
  });
});
