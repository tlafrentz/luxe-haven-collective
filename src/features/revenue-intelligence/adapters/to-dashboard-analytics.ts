import type {
  DashboardAnalytics,
  DashboardMetrics,
} from "@/features/analytics";

import type {
  PropertyPerformance,
  RevenueIntelligence,
} from "../types";

function toDashboardMetrics(
  performance: PropertyPerformance,
): DashboardMetrics {
  return {
    grossRevenue:
      performance.revenue.grossRevenue,
    roomRevenue:
      performance.revenue.roomRevenue,
    occupiedNights:
      performance.occupancy.occupiedNights,
    availableNights:
      performance.occupancy.availableNights,
    occupancyRate:
      performance.occupancy.occupancyRate,
    averageDailyRate:
      performance.revenue.averageDailyRate,
    revPar: performance.revenue.revPar,
    averageLengthOfStay:
      performance.bookings.averageLengthOfStay,
    averageBookingLeadTime:
      performance.bookings
        .averageBookingLeadTime,
    cancellationRate:
      performance.bookings.cancellationRate,
    totalBookings:
      performance.bookings.totalBookings,
    upcomingBookings:
      performance.bookings.upcomingBookings,
    completedBookings:
      performance.bookings.completedBookings,
    cancelledBookings:
      performance.bookings.cancelledBookings,
    revenueBreakdown:
      performance.revenue.breakdown,
    bookingSources:
      performance.bookingBehavior.sources,
    stayLengthDistribution:
      performance.bookingBehavior
        .stayLengthDistribution,
  };
}

export function toDashboardAnalytics(
  intelligence: RevenueIntelligence,
): DashboardAnalytics {
  const {
    report,
    bookings,
  } = intelligence;

  return {
    metrics: toDashboardMetrics(
      report.current,
    ),
    previousMetrics: toDashboardMetrics(
      report.previous,
    ),
    comparison: {
      revenue:
        report.comparison.grossRevenue,
      occupancy:
        report.comparison.occupancyRate,
      adr:
        report.comparison.averageDailyRate,
      revPar: report.comparison.revPar,
    },
    bookings,
    properties: report.properties,
    dateRange: report.dateRange,
    previousDateRange:
      report.previousDateRange,
    selectedPropertyId:
      report.selectedProperty?.id ?? null,
  };
}
