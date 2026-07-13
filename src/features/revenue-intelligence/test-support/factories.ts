import type {
  AnalyticsBooking,
  BookingSourceMetric,
  OccupancyDataPoint,
} from "@/features/analytics";

import type {
  OpportunityDetectionContext,
  PropertyPerformance,
  RevenueOpportunity,
} from "../types";

export function createAnalyticsBooking(
  overrides: Partial<AnalyticsBooking> = {},
): AnalyticsBooking {
  return {
    id: "booking-1",
    propertyId: "property-1",
    guestFullName: "Test Guest",
    checkIn: "2026-07-15",
    checkOut: "2026-07-18",
    guests: 2,
    nightlyRate: 150,
    cleaningFee: 75,
    taxes: 30,
    serviceFee: 20,
    totalAmount: 575,
    status: "confirmed",
    paymentStatus: "paid",
    source: "airbnb",
    createdAt: "2026-06-15T12:00:00.000Z",
    ...overrides,
  };
}

export function createBookingSourceMetric(
  overrides: Partial<BookingSourceMetric> = {},
): BookingSourceMetric {
  return {
    source: "airbnb",
    bookingCount: 5,
    bookingShare: 50,
    occupiedNights: 15,
    roomRevenue: 2250,
    averageDailyRate: 150,
    ...overrides,
  };
}

export function createPropertyPerformance(
  overrides: Partial<PropertyPerformance> = {},
): PropertyPerformance {
  const base: PropertyPerformance = {
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
      grossRevenue: 3000,
      roomRevenue: 2400,
      averageDailyRate: 150,
      revPar: 77.42,
      breakdown: {
        roomRevenue: 2400,
        cleaningFees: 300,
        taxes: 180,
        serviceFees: 120,
        otherRevenue: 0,
        grossRevenue: 3000,
      },
    },
    occupancy: {
      occupiedNights: 16,
      availableNights: 31,
      occupancyRate: 51.6,
    },
    bookings: {
      totalBookings: 5,
      upcomingBookings: 3,
      completedBookings: 2,
      cancelledBookings: 0,
      cancellationRate: 0,
      averageBookingLeadTime: 30,
      averageLengthOfStay: 3.2,
    },
    bookingBehavior: {
      sources: [
        createBookingSourceMetric(),
        createBookingSourceMetric({
          source: "direct",
          bookingCount: 5,
          bookingShare: 50,
          occupiedNights: 15,
          roomRevenue: 2250,
        }),
      ],
      stayLengthDistribution: [],
    },
  };

  return {
    ...base,
    ...overrides,
    scope: overrides.scope ?? base.scope,
    period: overrides.period ?? base.period,
    revenue: overrides.revenue ?? base.revenue,
    occupancy:
      overrides.occupancy ?? base.occupancy,
    bookings: overrides.bookings ?? base.bookings,
    bookingBehavior:
      overrides.bookingBehavior ??
      base.bookingBehavior,
  };
}

export function createOccupancyDataPoint(
  overrides: Partial<OccupancyDataPoint> = {},
): OccupancyDataPoint {
  return {
    date: "2026-07-01",
    occupiedNights: 1,
    availableNights: 1,
    occupancyRate: 100,
    ...overrides,
  };
}

export function createOpportunity(
  overrides: Partial<RevenueOpportunity> = {},
): RevenueOpportunity {
  return {
    id: "opportunity-1",
    detectorId: "test-detector",
    type: "gap-night",
    category: "occupancy",
    severity: "medium",
    confidence: "medium",
    status: "open",
    propertyId: "property-1",
    detectedAt: "2026-07-12T18:00:00.000Z",
    title: "Test opportunity",
    summary: "A test opportunity was detected.",
    evidence: [],
    impact: {
      type: "revenue-increase",
      estimatedAmount: 100,
      currency: "USD",
      basis: "Test calculation.",
    },
    action: {
      type: "monitor",
      summary: "Review the opportunity.",
    },
    ...overrides,
  };
}

export function createOpportunityDetectionContext(
  overrides: Partial<OpportunityDetectionContext> = {},
): OpportunityDetectionContext {
  return {
    performance: createPropertyPerformance(),
    previousPerformance:
      createPropertyPerformance({
        period: {
          startDate: "2026-06-01",
          endDate: "2026-07-01",
        },
      }),
    bookings: [],
    occupancySeries: [],
    detectedAt: "2026-07-12T18:00:00.000Z",
    ...overrides,
  };
}
