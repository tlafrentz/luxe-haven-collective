import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createOccupancyDataPoint,
  createOpportunityDetectionContext,
} from "../test-support/factories";

import {
  lowWeekdayOccupancyOpportunityDetector,
} from "./low-weekday-occupancy";

function createSeries({
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

describe(
  "lowWeekdayOccupancyOpportunityDetector",
  () => {
    it("detects low weekday occupancy when weekend performance is materially stronger", () => {
      const context =
        createOpportunityDetectionContext({
          occupancySeries: createSeries({
            weekdayAvailable: 20,
            weekdayOccupied: 6,
            weekendAvailable: 10,
            weekendOccupied: 9,
          }),
        });

      const result =
        lowWeekdayOccupancyOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);

      expect(result[0]).toMatchObject({
        id:
          "low-weekday-occupancy:low-weekday-occupancy:property-1",
        detectorId:
          "low-weekday-occupancy",
        type: "low-weekday-occupancy",
        category: "occupancy",
        severity: "high",
        confidence: "medium",
        propertyId: "property-1",
        action: {
          type: "promote-availability",
        },
      });

      expect(result[0].evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "weekdayOccupancyRate",
            value: 30,
          }),
          expect.objectContaining({
            key: "weekendOccupancyRate",
            value: 90,
          }),
          expect.objectContaining({
            key: "occupancyGap",
            value: 60,
          }),
          expect.objectContaining({
            key: "weekdayAvailableNights",
            value: 20,
          }),
        ]),
      );
    });

    it("detects critically low weekday occupancy even without a twenty-point weekend gap", () => {
      const context =
        createOpportunityDetectionContext({
          occupancySeries: createSeries({
            weekdayAvailable: 20,
            weekdayOccupied: 4,
            weekendAvailable: 10,
            weekendOccupied: 3,
          }),
        });

      const result =
        lowWeekdayOccupancyOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);

      expect(result[0]).toMatchObject({
        severity: "high",
      });

      expect(result[0].evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "weekdayOccupancyRate",
            value: 20,
          }),
          expect.objectContaining({
            key: "occupancyGap",
            value: 10,
          }),
        ]),
      );
    });

    it("uses high confidence with at least forty weekday available nights", () => {
      const context =
        createOpportunityDetectionContext({
          occupancySeries: createSeries({
            weekdayAvailable: 40,
            weekdayOccupied: 12,
            weekendAvailable: 16,
            weekendOccupied: 14,
          }),
        });

      const result =
        lowWeekdayOccupancyOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(
        "high",
      );
    });

    it("uses low confidence with ten to nineteen weekday available nights", () => {
      const context =
        createOpportunityDetectionContext({
          occupancySeries: createSeries({
            weekdayAvailable: 10,
            weekdayOccupied: 3,
            weekendAvailable: 8,
            weekendOccupied: 8,
          }),
        });

      const result =
        lowWeekdayOccupancyOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(
        "low",
      );
    });

    it("does not trigger with fewer than ten weekday available nights", () => {
      const context =
        createOpportunityDetectionContext({
          occupancySeries: createSeries({
            weekdayAvailable: 9,
            weekdayOccupied: 0,
            weekendAvailable: 8,
            weekendOccupied: 8,
          }),
        });

      expect(
        lowWeekdayOccupancyOpportunityDetector.detect(
          context,
        ),
      ).toEqual([]);
    });

    it("does not trigger when weekday occupancy is at least forty-five percent", () => {
      const context =
        createOpportunityDetectionContext({
          occupancySeries: createSeries({
            weekdayAvailable: 20,
            weekdayOccupied: 9,
            weekendAvailable: 10,
            weekendOccupied: 10,
          }),
        });

      expect(
        lowWeekdayOccupancyOpportunityDetector.detect(
          context,
        ),
      ).toEqual([]);
    });

    it("does not trigger when weekday occupancy is between thirty and forty-five percent without a sufficient weekend gap", () => {
      const context =
        createOpportunityDetectionContext({
          occupancySeries: createSeries({
            weekdayAvailable: 20,
            weekdayOccupied: 7,
            weekendAvailable: 10,
            weekendOccupied: 5,
          }),
        });

      expect(
        lowWeekdayOccupancyOpportunityDetector.detect(
          context,
        ),
      ).toEqual([]);
    });

    it("returns no opportunity when the occupancy series is absent", () => {
      const context =
        createOpportunityDetectionContext({
          occupancySeries: undefined,
        });

      expect(
        lowWeekdayOccupancyOpportunityDetector.detect(
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
        lowWeekdayOccupancyOpportunityDetector.detect(
          context,
        ),
      ).toEqual([]);
    });

    it("treats Sunday through Thursday as weekdays and Friday through Saturday as weekends", () => {
      const context =
        createOpportunityDetectionContext({
          occupancySeries: [
            createOccupancyDataPoint({
              date: "2026-07-05",
              availableNights: 10,
              occupiedNights: 2,
            }),
            createOccupancyDataPoint({
              date: "2026-07-09",
              availableNights: 10,
              occupiedNights: 2,
            }),
            createOccupancyDataPoint({
              date: "2026-07-10",
              availableNights: 5,
              occupiedNights: 5,
            }),
            createOccupancyDataPoint({
              date: "2026-07-11",
              availableNights: 5,
              occupiedNights: 5,
            }),
          ],
        });

      const result =
        lowWeekdayOccupancyOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);

      expect(result[0].evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "weekdayOccupancyRate",
            value: 20,
          }),
          expect.objectContaining({
            key: "weekendOccupancyRate",
            value: 100,
          }),
        ]),
      );
    });
  },
);
