import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createOpportunityDetectionContext,
  createPropertyPerformance,
} from "../test-support/factories";

import {
  cancellationsOpportunityDetector,
} from "./cancellations";

function createCancellationContext({
  currentRate,
  previousRate,
  totalBookings,
  cancelledBookings,
}: {
  currentRate: number;
  previousRate: number;
  totalBookings: number;
  cancelledBookings: number;
}) {
  return createOpportunityDetectionContext({
    performance:
      createPropertyPerformance({
        bookings: {
          totalBookings,
          upcomingBookings: 0,
          completedBookings:
            totalBookings,
          cancelledBookings,
          cancellationRate: currentRate,
          averageBookingLeadTime: 20,
          averageLengthOfStay: 3,
        },
      }),
    previousPerformance:
      createPropertyPerformance({
        period: {
          startDate: "2026-06-01",
          endDate: "2026-07-01",
        },
        bookings: {
          totalBookings: 10,
          upcomingBookings: 0,
          completedBookings: 10,
          cancelledBookings:
            previousRate > 0 ? 1 : 0,
          cancellationRate: previousRate,
          averageBookingLeadTime: 20,
          averageLengthOfStay: 3,
        },
      }),
  });
}

describe("cancellationsOpportunityDetector", () => {
  it("detects an elevated cancellation rate that increased materially", () => {
    const context =
      createCancellationContext({
        currentRate: 25,
        previousRate: 10,
        totalBookings: 9,
        cancelledBookings: 3,
      });

    const result =
      cancellationsOpportunityDetector.detect(
        context,
      );

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      id:
        "cancellations:elevated-cancellation-rate:property-1",
      detectorId: "cancellations",
      type: "elevated-cancellation-rate",
      category: "operations",
      severity: "high",
      confidence: "medium",
      status: "open",
      propertyId: "property-1",
      dateRange: {
        startDate: "2026-07-01",
        endDate: "2026-08-01",
      },
      impact: {
        type: "operational-risk",
      },
      action: {
        type: "review-cancellation-policy",
      },
    });

    expect(result[0].evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "currentCancellationRate",
          value: 25,
        }),
        expect.objectContaining({
          key: "previousCancellationRate",
          value: 10,
        }),
        expect.objectContaining({
          key: "cancellationRateDifference",
          value: 15,
        }),
        expect.objectContaining({
          key: "cancelledReservationCount",
          value: 3,
        }),
        expect.objectContaining({
          key: "resolvedReservationCount",
          value: 12,
        }),
      ]),
    );
  });

  it("detects an absolute cancellation risk even without a five-point increase", () => {
    const context =
      createCancellationContext({
        currentRate: 28,
        previousRate: 25,
        totalBookings: 10,
        cancelledBookings: 4,
      });

    const result =
      cancellationsOpportunityDetector.detect(
        context,
      );

    expect(result).toHaveLength(1);
    expect(result[0].severity).toBe(
      "medium",
    );
  });

  it("uses high confidence for at least fifteen resolved bookings", () => {
    const context =
      createCancellationContext({
        currentRate: 20,
        previousRate: 10,
        totalBookings: 14,
        cancelledBookings: 4,
      });

    const result =
      cancellationsOpportunityDetector.detect(
        context,
      );

    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(
      "high",
    );
  });

  it("uses low confidence for four to seven resolved bookings", () => {
    const context =
      createCancellationContext({
        currentRate: 25,
        previousRate: 0,
        totalBookings: 3,
        cancelledBookings: 1,
      });

    const result =
      cancellationsOpportunityDetector.detect(
        context,
      );

    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(
      "low",
    );
  });

  it("does not trigger below the minimum resolved-booking count", () => {
    const context =
      createCancellationContext({
        currentRate: 50,
        previousRate: 0,
        totalBookings: 2,
        cancelledBookings: 1,
      });

    expect(
      cancellationsOpportunityDetector.detect(
        context,
      ),
    ).toEqual([]);
  });

  it("does not trigger below the minimum cancellation rate", () => {
    const context =
      createCancellationContext({
        currentRate: 14.9,
        previousRate: 0,
        totalBookings: 10,
        cancelledBookings: 2,
      });

    expect(
      cancellationsOpportunityDetector.detect(
        context,
      ),
    ).toEqual([]);
  });

  it("does not trigger when the rate is elevated but neither increasing nor absolutely high", () => {
    const context =
      createCancellationContext({
        currentRate: 20,
        previousRate: 18,
        totalBookings: 10,
        cancelledBookings: 3,
      });

    expect(
      cancellationsOpportunityDetector.detect(
        context,
      ),
    ).toEqual([]);
  });

  it("uses zero as the comparison rate when prior performance is unavailable", () => {
    const context =
      createOpportunityDetectionContext({
        performance:
          createPropertyPerformance({
            bookings: {
              totalBookings: 8,
              upcomingBookings: 0,
              completedBookings: 8,
              cancelledBookings: 2,
              cancellationRate: 20,
              averageBookingLeadTime: 20,
              averageLengthOfStay: 3,
            },
          }),
        previousPerformance: undefined,
      });

    const result =
      cancellationsOpportunityDetector.detect(
        context,
      );

    expect(result).toHaveLength(1);

    expect(result[0].evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "previousCancellationRate",
          value: 0,
        }),
      ]),
    );
  });
});
