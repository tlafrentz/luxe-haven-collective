import type {
  AnalyticsBooking,
  AnalyticsDateRange,
} from "../domain/revenue-input";
import { revenueAnalyticsGateway } from "../adapters/analytics-input-adapter";

import type {
  PerformanceScope,
  PropertyPerformance,
} from "../domain/property-performance";

type CalculatePropertyPerformanceParams = {
  bookings: AnalyticsBooking[];
  propertyCount: number;
  dateRange: AnalyticsDateRange;
  propertyId?: string | null;
  today?: string;
};

function createPerformanceScope({
  propertyId,
  propertyCount,
}: {
  propertyId?: string | null;
  propertyCount: number;
}): PerformanceScope {
  if (propertyId) {
    return {
      type: "property",
      propertyId,
      propertyCount: 1,
    };
  }

  return {
    type: "portfolio",
    propertyId: null,
    propertyCount,
  };
}

export function calculatePropertyPerformance({
  bookings,
  propertyCount,
  dateRange,
  propertyId,
  today,
}: CalculatePropertyPerformanceParams): PropertyPerformance {
  const scope = createPerformanceScope({
    propertyId,
    propertyCount,
  });

  const metrics = revenueAnalyticsGateway.dashboardMetrics({
    bookings,
    propertyCount: scope.propertyCount,
    dateRange,
    today,
  });

  return {
    scope,
    period: dateRange,
    revenue: {
      grossRevenue: metrics.grossRevenue,
      roomRevenue: metrics.roomRevenue,
      averageDailyRate:
        metrics.averageDailyRate,
      revPar: metrics.revPar,
      breakdown: metrics.revenueBreakdown,
    },
    occupancy: {
      occupiedNights: metrics.occupiedNights,
      availableNights: metrics.availableNights,
      occupancyRate: metrics.occupancyRate,
    },
    bookings: {
      totalBookings: metrics.totalBookings,
      upcomingBookings: metrics.upcomingBookings,
      completedBookings: metrics.completedBookings,
      cancelledBookings: metrics.cancelledBookings,
      cancellationRate: metrics.cancellationRate,
      averageBookingLeadTime:
        metrics.averageBookingLeadTime,
      averageLengthOfStay:
        metrics.averageLengthOfStay,
    },
    bookingBehavior: {
      sources: metrics.bookingSources,
      stayLengthDistribution:
        metrics.stayLengthDistribution,
    },
  };
}
