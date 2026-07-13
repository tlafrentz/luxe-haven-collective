import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createOccupancyDataPoint,
  createOpportunityDetectionContext,
  createPropertyPerformance,
} from "../test-support/factories";

import {
  weekendPricingOpportunityDetector,
} from "./weekend-pricing";

function createPricingSeries({
  weekdayAvailable,
  weekdayOccupied,
  weekendAvailable,
  weekendOccupied,
}: {
  weekdayAvailable: number;
  weekdayOccupied: number;
  weekendAvailable: number;
  weekendOccupied: number;
}) {
  return [
    createOccupancyDataPoint({
      date: "2026-07-06",
      availableNights:
        weekdayAvailable,
      occupiedNights:
        weekdayOccupied,
      occupancyRate: 0,
    }),
    createOccupancyDataPoint({
      date: "2026-07-10",
      availableNights:
        weekendAvailable,
      occupiedNights:
        weekendOccupied,
      occupancyRate: 0,
    }),
  ];
}

function createPricingContext({
  averageDailyRate = 150,
  weekdayAvailable = 20,
  weekdayOccupied = 10,
  weekendAvailable = 20,
  weekendOccupied = 18,
}: {
  averageDailyRate?: number;
  weekdayAvailable?: number;
  weekdayOccupied?: number;
  weekendAvailable?: number;
  weekendOccupied?: number;
} = {}) {
  const basePerformance =
    createPropertyPerformance();

  return createOpportunityDetectionContext({
    performance:
      createPropertyPerformance({
        revenue: {
          ...basePerformance.revenue,
          averageDailyRate,
        },
      }),
    occupancySeries: createPricingSeries({
      weekdayAvailable,
      weekdayOccupied,
      weekendAvailable,
      weekendOccupied,
    }),
  });
}

describe(
  "weekendPricingOpportunityDetector",
  () => {
    it("detects strong weekend demand that may support higher rates", () => {
      const context = createPricingContext();

      const result =
        weekendPricingOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);

      expect(result[0]).toMatchObject({
        id:
          "weekend-pricing:underpriced-weekend:property-1",
        detectorId: "weekend-pricing",
        type: "underpriced-weekend",
        category: "pricing",
        severity: "high",
        confidence: "high",
        propertyId: "property-1",
        impact: {
          type: "revenue-increase",
          estimatedAmount: 216,
          estimatedPercentage: 8,
          currency: "USD",
        },
        action: {
          type: "increase-rate",
          parameters: {
            suggestedIncreasePercent: 8,
            currentAverageDailyRate: 150,
            suggestedReferenceRate: 162,
            weekendOccupancyRate: 90,
            weekdayOccupancyRate: 50,
          },
        },
      });

      expect(result[0].evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "weekendOccupancyRate",
            value: 90,
          }),
          expect.objectContaining({
            key: "weekdayOccupancyRate",
            value: 50,
          }),
          expect.objectContaining({
            key: "occupancyGap",
            value: 40,
          }),
          expect.objectContaining({
            key: "suggestedIncreasePercent",
            value: 8,
          }),
        ]),
      );
    });

    it("suggests a ten-percent increase at ninety-five percent occupancy", () => {
      const context = createPricingContext({
        weekendAvailable: 20,
        weekendOccupied: 19,
      });

      const result =
        weekendPricingOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);

      expect(result[0]).toMatchObject({
        severity: "high",
        impact: {
          estimatedAmount: 285,
          estimatedPercentage: 10,
        },
        action: {
          parameters: {
            suggestedIncreasePercent: 10,
            suggestedReferenceRate: 165,
          },
        },
      });
    });

    it("suggests a five-percent increase between eighty-five and ninety percent occupancy", () => {
      const context = createPricingContext({
        weekendAvailable: 20,
        weekendOccupied: 17,
        weekdayAvailable: 20,
        weekdayOccupied: 10,
      });

      const result =
        weekendPricingOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);

      expect(result[0]).toMatchObject({
        impact: {
          estimatedAmount: 127.5,
          estimatedPercentage: 5,
        },
        action: {
          parameters: {
            suggestedIncreasePercent: 5,
            suggestedReferenceRate: 157.5,
          },
        },
      });
    });

    it("uses high severity when the weekend occupancy advantage is at least forty points", () => {
      const context = createPricingContext({
        weekdayAvailable: 20,
        weekdayOccupied: 8,
        weekendAvailable: 20,
        weekendOccupied: 18,
      });

      const result =
        weekendPricingOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe(
        "high",
      );
    });

    it("uses medium confidence for moderate weekend volume", () => {
      const context = createPricingContext({
        weekdayAvailable: 20,
        weekdayOccupied: 8,
        weekendAvailable: 12,
        weekendOccupied: 11,
      });

      const result =
        weekendPricingOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(
        "medium",
      );
    });

    it("uses low confidence at the minimum weekend volume", () => {
      const context = createPricingContext({
        weekdayAvailable: 20,
        weekdayOccupied: 8,
        weekendAvailable: 8,
        weekendOccupied: 7,
      });

      const result =
        weekendPricingOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(
        "low",
      );
    });

    it("does not trigger below eight weekend available nights", () => {
      const context = createPricingContext({
        weekendAvailable: 7,
        weekendOccupied: 7,
      });

      expect(
        weekendPricingOpportunityDetector.detect(
          context,
        ),
      ).toEqual([]);
    });

    it("does not trigger below six occupied weekend nights", () => {
      const context = createPricingContext({
        weekendAvailable: 8,
        weekendOccupied: 5,
        weekdayAvailable: 20,
        weekdayOccupied: 0,
      });

      expect(
        weekendPricingOpportunityDetector.detect(
          context,
        ),
      ).toEqual([]);
    });

    it("does not trigger below eighty-five percent weekend occupancy", () => {
      const context = createPricingContext({
        weekendAvailable: 20,
        weekendOccupied: 16,
        weekdayAvailable: 20,
        weekdayOccupied: 5,
      });

      expect(
        weekendPricingOpportunityDetector.detect(
          context,
        ),
      ).toEqual([]);
    });

    it("does not trigger when the weekend occupancy advantage is below fifteen points", () => {
      const context = createPricingContext({
        weekdayAvailable: 20,
        weekdayOccupied: 16,
        weekendAvailable: 20,
        weekendOccupied: 18,
      });

      expect(
        weekendPricingOpportunityDetector.detect(
          context,
        ),
      ).toEqual([]);
    });

    it("does not trigger when ADR is zero", () => {
      const context = createPricingContext({
        averageDailyRate: 0,
      });

      expect(
        weekendPricingOpportunityDetector.detect(
          context,
        ),
      ).toEqual([]);
    });

    it("returns no opportunity when the occupancy series is missing", () => {
      const context =
        createOpportunityDetectionContext({
          occupancySeries: undefined,
        });

      expect(
        weekendPricingOpportunityDetector.detect(
          context,
        ),
      ).toEqual([]);
    });

    it("returns no opportunity when the occupancy series is empty", () => {
      const context =
        createOpportunityDetectionContext({
          occupancySeries: [],
        });

      expect(
        weekendPricingOpportunityDetector.detect(
          context,
        ),
      ).toEqual([]);
    });

    it("treats Friday and Saturday as weekend inventory", () => {
      const context =
        createOpportunityDetectionContext({
          occupancySeries: [
            createOccupancyDataPoint({
              date: "2026-07-05",
              availableNights: 10,
              occupiedNights: 4,
            }),
            createOccupancyDataPoint({
              date: "2026-07-09",
              availableNights: 10,
              occupiedNights: 4,
            }),
            createOccupancyDataPoint({
              date: "2026-07-10",
              availableNights: 10,
              occupiedNights: 9,
            }),
            createOccupancyDataPoint({
              date: "2026-07-11",
              availableNights: 10,
              occupiedNights: 9,
            }),
          ],
        });

      const result =
        weekendPricingOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);

      expect(result[0].evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "weekdayOccupancyRate",
            value: 40,
          }),
          expect.objectContaining({
            key: "weekendOccupancyRate",
            value: 90,
          }),
        ]),
      );
    });
  },
);
