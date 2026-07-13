import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createAnalyticsBooking,
  createOpportunityDetectionContext,
} from "../test-support/factories";

import {
  gapNightOpportunityDetector,
} from "./gap-nights";

describe("gapNightOpportunityDetector", () => {
  it("detects a two-night gap between active reservations", () => {
    const context =
      createOpportunityDetectionContext({
        detectedAt:
          "2026-07-12T18:00:00.000Z",
        bookings: [
          createAnalyticsBooking({
            id: "before",
            checkIn: "2026-07-15",
            checkOut: "2026-07-18",
            nightlyRate: 140,
          }),
          createAnalyticsBooking({
            id: "after",
            checkIn: "2026-07-20",
            checkOut: "2026-07-23",
            nightlyRate: 160,
          }),
        ],
      });

    const result =
      gapNightOpportunityDetector.detect(
        context,
      );

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      id:
        "gap-nights:gap-night:property-1:2026-07-18:2026-07-20",
      detectorId: "gap-nights",
      type: "gap-night",
      category: "occupancy",
      severity: "high",
      confidence: "high",
      propertyId: "property-1",
      dateRange: {
        startDate: "2026-07-18",
        endDate: "2026-07-20",
      },
      impact: {
        type: "revenue-increase",
        estimatedAmount: 300,
        currency: "USD",
      },
      action: {
        type: "apply-discount",
        parameters: {
          gapNights: 2,
          referenceNightlyRate: 150,
          suggestedDiscountPercent: 15,
        },
      },
    });

    expect(result[0].evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "gapNightCount",
          value: 2,
        }),
        expect.objectContaining({
          key: "daysUntilGap",
          value: 6,
        }),
        expect.objectContaining({
          key: "referenceNightlyRate",
          value: 150,
        }),
      ]),
    );
  });

  it.each([
    {
      gapEnd: "2026-07-19",
      expectedNights: 1,
    },
    {
      gapEnd: "2026-07-20",
      expectedNights: 2,
    },
    {
      gapEnd: "2026-07-21",
      expectedNights: 3,
    },
  ])(
    "detects an actionable $expectedNights-night gap",
    ({
      gapEnd,
      expectedNights,
    }) => {
      const context =
        createOpportunityDetectionContext({
          detectedAt:
            "2026-07-12T18:00:00.000Z",
          bookings: [
            createAnalyticsBooking({
              id: "before",
              checkIn: "2026-07-15",
              checkOut: "2026-07-18",
            }),
            createAnalyticsBooking({
              id: "after",
              checkIn: gapEnd,
              checkOut: "2026-07-25",
            }),
          ],
        });

      const result =
        gapNightOpportunityDetector.detect(
          context,
        );

      expect(result).toHaveLength(1);

      expect(result[0].evidence).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: "gapNightCount",
            value: expectedNights,
          }),
        ]),
      );
    },
  );

  it("does not detect gaps longer than three nights", () => {
    const context =
      createOpportunityDetectionContext({
        bookings: [
          createAnalyticsBooking({
            id: "before",
            checkOut: "2026-07-18",
          }),
          createAnalyticsBooking({
            id: "after",
            checkIn: "2026-07-22",
            checkOut: "2026-07-25",
          }),
        ],
      });

    expect(
      gapNightOpportunityDetector.detect(
        context,
      ),
    ).toEqual([]);
  });

  it("does not detect back-to-back reservations", () => {
    const context =
      createOpportunityDetectionContext({
        bookings: [
          createAnalyticsBooking({
            id: "before",
            checkOut: "2026-07-18",
          }),
          createAnalyticsBooking({
            id: "after",
            checkIn: "2026-07-18",
            checkOut: "2026-07-21",
          }),
        ],
      });

    expect(
      gapNightOpportunityDetector.detect(
        context,
      ),
    ).toEqual([]);
  });

  it("does not detect gaps that begin before the detection date", () => {
    const context =
      createOpportunityDetectionContext({
        detectedAt:
          "2026-07-20T18:00:00.000Z",
        bookings: [
          createAnalyticsBooking({
            id: "before",
            checkIn: "2026-07-10",
            checkOut: "2026-07-15",
          }),
          createAnalyticsBooking({
            id: "after",
            checkIn: "2026-07-17",
            checkOut: "2026-07-20",
          }),
        ],
      });

    expect(
      gapNightOpportunityDetector.detect(
        context,
      ),
    ).toEqual([]);
  });

  it("ignores canceled reservations", () => {
    const context =
      createOpportunityDetectionContext({
        bookings: [
          createAnalyticsBooking({
            id: "before",
            checkIn: "2026-07-15",
            checkOut: "2026-07-18",
          }),
          createAnalyticsBooking({
            id: "cancelled-middle",
            status: "cancelled",
            checkIn: "2026-07-18",
            checkOut: "2026-07-20",
          }),
          createAnalyticsBooking({
            id: "after",
            checkIn: "2026-07-21",
            checkOut: "2026-07-24",
          }),
        ],
      });

    const result =
      gapNightOpportunityDetector.detect(
        context,
      );

    expect(result).toHaveLength(1);

    expect(result[0].dateRange).toEqual({
      startDate: "2026-07-18",
      endDate: "2026-07-21",
    });
  });

  it("handles overlapping reservations without producing a false gap", () => {
    const context =
      createOpportunityDetectionContext({
        bookings: [
          createAnalyticsBooking({
            id: "first",
            checkIn: "2026-07-15",
            checkOut: "2026-07-20",
          }),
          createAnalyticsBooking({
            id: "overlap",
            checkIn: "2026-07-18",
            checkOut: "2026-07-22",
          }),
          createAnalyticsBooking({
            id: "after",
            checkIn: "2026-07-24",
            checkOut: "2026-07-27",
          }),
        ],
      });

    const result =
      gapNightOpportunityDetector.detect(
        context,
      );

    expect(result).toHaveLength(1);

    expect(result[0].dateRange).toEqual({
      startDate: "2026-07-22",
      endDate: "2026-07-24",
    });
  });

  it("never calculates a gap between different properties", () => {
    const context =
      createOpportunityDetectionContext({
        bookings: [
          createAnalyticsBooking({
            id: "property-one",
            propertyId: "property-1",
            checkIn: "2026-07-15",
            checkOut: "2026-07-18",
          }),
          createAnalyticsBooking({
            id: "property-two",
            propertyId: "property-2",
            checkIn: "2026-07-20",
            checkOut: "2026-07-23",
          }),
        ],
      });

    expect(
      gapNightOpportunityDetector.detect(
        context,
      ),
    ).toEqual([]);
  });

  it("can return gaps for multiple properties", () => {
    const context =
      createOpportunityDetectionContext({
        bookings: [
          createAnalyticsBooking({
            id: "p1-before",
            propertyId: "property-1",
            checkIn: "2026-07-15",
            checkOut: "2026-07-18",
          }),
          createAnalyticsBooking({
            id: "p1-after",
            propertyId: "property-1",
            checkIn: "2026-07-20",
            checkOut: "2026-07-23",
          }),
          createAnalyticsBooking({
            id: "p2-before",
            propertyId: "property-2",
            checkIn: "2026-07-16",
            checkOut: "2026-07-19",
          }),
          createAnalyticsBooking({
            id: "p2-after",
            propertyId: "property-2",
            checkIn: "2026-07-22",
            checkOut: "2026-07-25",
          }),
        ],
      });

    const result =
      gapNightOpportunityDetector.detect(
        context,
      );

    expect(result).toHaveLength(2);

    expect(
      result.map(
        (opportunity) =>
          opportunity.propertyId,
      ),
    ).toEqual([
      "property-1",
      "property-2",
    ]);
  });

  it("uses medium severity for a gap fifteen to thirty days away", () => {
    const context =
      createOpportunityDetectionContext({
        detectedAt:
          "2026-07-01T12:00:00.000Z",
        bookings: [
          createAnalyticsBooking({
            id: "before",
            checkIn: "2026-07-15",
            checkOut: "2026-07-20",
          }),
          createAnalyticsBooking({
            id: "after",
            checkIn: "2026-07-22",
            checkOut: "2026-07-25",
          }),
        ],
      });

    const result =
      gapNightOpportunityDetector.detect(
        context,
      );

    expect(result[0].severity).toBe(
      "medium",
    );
  });

  it("uses low severity for a gap more than thirty days away", () => {
    const context =
      createOpportunityDetectionContext({
        detectedAt:
          "2026-07-01T12:00:00.000Z",
        bookings: [
          createAnalyticsBooking({
            id: "before",
            checkIn: "2026-08-05",
            checkOut: "2026-08-10",
          }),
          createAnalyticsBooking({
            id: "after",
            checkIn: "2026-08-12",
            checkOut: "2026-08-15",
          }),
        ],
      });

    const result =
      gapNightOpportunityDetector.detect(
        context,
      );

    expect(result[0].severity).toBe("low");
  });

  it("uses medium confidence when only one surrounding rate is positive", () => {
    const context =
      createOpportunityDetectionContext({
        bookings: [
          createAnalyticsBooking({
            id: "before",
            checkOut: "2026-07-18",
            nightlyRate: 0,
          }),
          createAnalyticsBooking({
            id: "after",
            checkIn: "2026-07-20",
            checkOut: "2026-07-23",
            nightlyRate: 180,
          }),
        ],
      });

    const result =
      gapNightOpportunityDetector.detect(
        context,
      );

    expect(result[0]).toMatchObject({
      confidence: "medium",
      impact: {
        estimatedAmount: 360,
      },
    });
  });

  it("uses low confidence and zero impact when neither surrounding rate is positive", () => {
    const context =
      createOpportunityDetectionContext({
        bookings: [
          createAnalyticsBooking({
            id: "before",
            checkOut: "2026-07-18",
            nightlyRate: 0,
          }),
          createAnalyticsBooking({
            id: "after",
            checkIn: "2026-07-20",
            checkOut: "2026-07-23",
            nightlyRate: 0,
          }),
        ],
      });

    const result =
      gapNightOpportunityDetector.detect(
        context,
      );

    expect(result[0]).toMatchObject({
      confidence: "low",
      impact: {
        estimatedAmount: 0,
      },
    });
  });
});
