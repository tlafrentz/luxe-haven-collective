import type {
  PropertyPerformance,
  RevenueIntelligence,
  RevenueOpportunity,
} from "../types";

export const RECORDED_AT =
  new Date("2026-07-19T15:30:00.000Z");

export function createPropertyPerformance():
  PropertyPerformance {
  return {
    scope: {
      type: "property",
      propertyId: "property-001",
      propertyCount: 1,
    },
    period: {
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    },
    revenue: {
      grossRevenue: 12000,
      roomRevenue: 11000,
      averageDailyRate: 220,
      revPar: 154,
      breakdown: {
        roomRevenue: 11000,
        cleaningFees: 800,
        taxes: 400,
        serviceFees: 600,
        otherRevenue: 200,
        grossRevenue: 12000,
      },
    },
    occupancy: {
      occupiedNights: 21,
      availableNights: 30,
      occupancyRate: 70,
    },
    bookings: {
      totalBookings: 8,
      upcomingBookings: 3,
      completedBookings: 4,
      cancelledBookings: 1,
      cancellationRate: 12.5,
      averageBookingLeadTime: 19,
      averageLengthOfStay: 3.2,
    },
    bookingBehavior: {
      sources: [],
      stayLengthDistribution: [],
    },
  };
}

export function createRevenueOpportunity():
  RevenueOpportunity {
  return {
    id: "opportunity-001",
    detectorId:
      "low-weekday-occupancy-detector",
    type: "low-weekday-occupancy",
    category: "occupancy",
    severity: "high",
    confidence: "high",
    status: "open",
    propertyId: "property-001",
    detectedAt:
      "2026-07-19T15:00:00.000Z",
    title: "Low weekday occupancy",
    summary:
      "Weekday occupancy is below target.",
    evidence: [
      {
        key: "weekday-occupancy-rate",
        label: "Weekday occupancy rate",
        value: 42,
        unit: "percentage",
      },
      {
        key: "available-weekday-nights",
        label: "Available weekday nights",
        value: 8,
        unit: "nights",
      },
    ],
    impact: {
      type: "occupancy-increase",
      estimatedAmount: 600,
      currency: "USD",
      basis: "Available weekday inventory",
    },
    action: {
      type: "apply-discount",
      summary:
        "Apply a targeted weekday discount.",
    },
  };
}

export function createRevenueIntelligence():
  RevenueIntelligence {
  const current = createPropertyPerformance();

  return {
    generatedAt: RECORDED_AT.toISOString(),
    bookings: [],
    occupancySeries: [],
    report: {
      current,
      previous: {
        ...current,
        period: {
          startDate: "2026-06-01",
          endDate: "2026-06-30",
        },
      },
      comparison: {
        grossRevenue: {
          difference: 12000,
          percentChange: 100,
          direction: "up",
        },
        roomRevenue: {
          difference: 11000,
          percentChange: 100,
          direction: "up",
        },
        occupancyRate: {
          difference: 70,
          percentChange: 100,
          direction: "up",
        },
        averageDailyRate: {
          difference: 220,
          percentChange: 100,
          direction: "up",
        },
        revPar: {
          difference: 154,
          percentChange: 100,
          direction: "up",
        },
        averageLengthOfStay: {
          difference: 3.2,
          percentChange: 100,
          direction: "up",
        },
        averageBookingLeadTime: {
          difference: 19,
          percentChange: 100,
          direction: "up",
        },
        cancellationRate: {
          difference: 12.5,
          percentChange: 100,
          direction: "up",
        },
      },
      properties: [],
      selectedProperty: null,
      dateRange: current.period,
      previousDateRange: {
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      },
    },
    opportunityReport: {
      generatedAt: RECORDED_AT.toISOString(),
      summary: {
        total: 1,
        highPriority: 1,
        mediumPriority: 0,
        lowPriority: 0,
        estimatedRevenueImpact: 600,
        currency: "USD",
        byCategory: {
          pricing: 0,
          occupancy: 1,
          revenue: 0,
          distribution: 0,
          operations: 0,
        },
        bySeverity: {
          high: 1,
          medium: 0,
          low: 0,
        },
      },
      opportunities: [
        createRevenueOpportunity(),
      ],
    },
  };
}
