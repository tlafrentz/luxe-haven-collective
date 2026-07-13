import {
  describe,
  expect,
  it,
} from "vitest";

import {
  runOpportunityEngine,
} from "../services/run-opportunity-engine";

import type {
  OpportunityDetectionContext,
  PropertyPerformance,
} from "../types";

function createEmptyPerformance(): PropertyPerformance {
  return {
    scope: {
      type: "property",
      propertyId: "property-1",
      propertyCount: 1,
    },
    period: {
      startDate: "2026-07-01",
      endDate: "2026-08-01",
    },
    revenue: {
      grossRevenue: 0,
      roomRevenue: 0,
      averageDailyRate: 0,
      revPar: 0,
      breakdown: {
        roomRevenue: 0,
        cleaningFees: 0,
        taxes: 0,
        serviceFees: 0,
        otherRevenue: 0,
        grossRevenue: 0,
      },
    },
    occupancy: {
      occupiedNights: 0,
      availableNights: 31,
      occupancyRate: 0,
    },
    bookings: {
      totalBookings: 0,
      upcomingBookings: 0,
      completedBookings: 0,
      cancelledBookings: 0,
      cancellationRate: 0,
      averageBookingLeadTime: 0,
      averageLengthOfStay: 0,
    },
    bookingBehavior: {
      sources: [],
      stayLengthDistribution: [],
    },
  };
}

describe("runOpportunityEngine", () => {
  it("returns a stable empty report when no detectors are supplied", () => {
    const context: OpportunityDetectionContext = {
      performance: createEmptyPerformance(),
      bookings: [],
      detectedAt: "2026-07-12T18:00:00.000Z",
    };

    const result = runOpportunityEngine({
      context,
      detectors: [],
    });

    expect(result).toEqual({
      opportunities: [],
      summary: {
        total: 0,
        highPriority: 0,
        mediumPriority: 0,
        lowPriority: 0,
        estimatedRevenueImpact: 0,
        currency: "USD",
        byCategory: {
          pricing: 0,
          occupancy: 0,
          revenue: 0,
          distribution: 0,
          operations: 0,
        },
        bySeverity: {
          high: 0,
          medium: 0,
          low: 0,
        },
      },
      generatedAt:
        "2026-07-12T18:00:00.000Z",
    });
  });
});
