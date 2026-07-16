import {
  describe,
  expect,
  it,
} from "vitest";

import {
  ConfidenceLevel,
} from "../domain";

import type {
  ComparableProperty,
  RevenueProjection,
} from "../domain";

import {
  calculateComparableAnalysis,
} from "./calculate-comparable-analysis";

function usd(amount: number) {
  return {
    amount,
    currency: "USD" as const,
  };
}

function createComparable(
  id: string,
  averageDailyRate: number,
  occupancy: number,
): ComparableProperty {
  return {
    id,
    distanceMiles: 1,
    bedrooms: 2,
    bathrooms: 1,
    averageDailyRate:
      usd(averageDailyRate),
    occupancy: {
      value: occupancy,
    },
    rating: {
      value: 4.8,
      max: 5,
    },
    reviewCount: 100,
    amenities: [],
  };
}

function createRevenueProjection(
  overrides: Partial<RevenueProjection> = {},
): RevenueProjection {
  return {
    projectedAdr: usd(200),
    projectedOccupancy: {
      value: 75,
    },
    projectedMonthlyRevenue:
      usd(4562.5),
    projectedAnnualRevenue:
      usd(54750),
    confidence: {
      value: 85,
    },
    ...overrides,
  };
}

describe("calculateComparableAnalysis", () => {
  it("calculates median comparable performance and revenue upside", () => {
    const result =
      calculateComparableAnalysis({
        comparables: [
          createComparable(
            "comparable-1",
            160,
            60,
          ),
          createComparable(
            "comparable-2",
            180,
            70,
          ),
          createComparable(
            "comparable-3",
            200,
            80,
          ),
        ],
        revenueProjection:
          createRevenueProjection(),
      });

    expect(
      result.medianAverageDailyRate,
    ).toEqual(usd(180));

    expect(
      result.medianOccupancy,
    ).toEqual({
      value: 70,
    });

    expect(
      result.projectedRevenueUpside,
    ).toEqual(
      usd(8760),
    );

    expect(
      result.marketPositionScore,
    ).toEqual({
      value: 55,
      max: 100,
    });

    expect(
      result.competitiveAdvantages,
    ).toEqual([
      "Projected ADR exceeds the comparable median.",
      "Projected occupancy exceeds the comparable median.",
    ]);

    expect(result.confidence).toBe(
      ConfidenceLevel.Low,
    );
  });

  it("calculates medians for an even comparable set", () => {
    const result =
      calculateComparableAnalysis({
        comparables: [
          createComparable(
            "comparable-1",
            150,
            60,
          ),
          createComparable(
            "comparable-2",
            170,
            70,
          ),
          createComparable(
            "comparable-3",
            190,
            80,
          ),
          createComparable(
            "comparable-4",
            210,
            90,
          ),
        ],
        revenueProjection:
          createRevenueProjection(),
      });

    expect(
      result.medianAverageDailyRate.amount,
    ).toBe(180);

    expect(
      result.medianOccupancy.value,
    ).toBe(75);
  });

  it("identifies performance below the comparable median", () => {
    const result =
      calculateComparableAnalysis({
        comparables: [
          createComparable(
            "comparable-1",
            200,
            75,
          ),
          createComparable(
            "comparable-2",
            220,
            80,
          ),
          createComparable(
            "comparable-3",
            240,
            85,
          ),
        ],
        revenueProjection:
          createRevenueProjection({
            projectedAdr: usd(180),
            projectedOccupancy: {
              value: 70,
            },
            projectedAnnualRevenue:
              usd(45990),
          }),
      });

    expect(
      result.projectedRevenueUpside.amount,
    ).toBe(0);

    expect(
      result.competitiveDisadvantages,
    ).toEqual([
      "Projected ADR is below the comparable median.",
      "Projected occupancy is below the comparable median.",
    ]);
  });

  it.each([
    {
      count: 2,
      confidence:
        ConfidenceLevel.VeryLow,
    },
    {
      count: 5,
      confidence:
        ConfidenceLevel.Moderate,
    },
    {
      count: 10,
      confidence:
        ConfidenceLevel.High,
    },
    {
      count: 20,
      confidence:
        ConfidenceLevel.VeryHigh,
    },
  ])(
    "assigns $confidence confidence for $count comparables",
    ({
      count,
      confidence,
    }) => {
      const comparables =
        Array.from(
          {
            length: count,
          },
          (_, index) =>
            createComparable(
              `comparable-${index + 1}`,
              180,
              70,
            ),
        );

      const result =
        calculateComparableAnalysis({
          comparables,
          revenueProjection:
            createRevenueProjection(),
        });

      expect(result.confidence).toBe(
        confidence,
      );
    },
  );

  it("rejects an empty comparable set", () => {
    expect(() =>
      calculateComparableAnalysis({
        comparables: [],
        revenueProjection:
          createRevenueProjection(),
      }),
    ).toThrow(
      "Comparable analysis requires at least one comparable property.",
    );
  });

  it("rejects invalid comparable occupancy", () => {
    expect(() =>
      calculateComparableAnalysis({
        comparables: [
          createComparable(
            "comparable-1",
            180,
            101,
          ),
        ],
        revenueProjection:
          createRevenueProjection(),
      }),
    ).toThrow(
      "Comparable comparable-1 occupancy must be between 0 and 100.",
    );
  });
});
