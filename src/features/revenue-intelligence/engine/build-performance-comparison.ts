import {
  calculateTrend,
} from "@/features/analytics";

import type {
  PerformanceComparison,
  PropertyPerformance,
} from "../types";

export function buildPerformanceComparison({
  current,
  previous,
}: {
  current: PropertyPerformance;
  previous: PropertyPerformance;
}): PerformanceComparison {
  return {
    grossRevenue: calculateTrend(
      current.revenue.grossRevenue,
      previous.revenue.grossRevenue,
    ),
    roomRevenue: calculateTrend(
      current.revenue.roomRevenue,
      previous.revenue.roomRevenue,
    ),
    occupancyRate: calculateTrend(
      current.occupancy.occupancyRate,
      previous.occupancy.occupancyRate,
    ),
    averageDailyRate: calculateTrend(
      current.revenue.averageDailyRate,
      previous.revenue.averageDailyRate,
    ),
    revPar: calculateTrend(
      current.revenue.revPar,
      previous.revenue.revPar,
    ),
    averageLengthOfStay: calculateTrend(
      current.bookings.averageLengthOfStay,
      previous.bookings.averageLengthOfStay,
    ),
    averageBookingLeadTime: calculateTrend(
      current.bookings.averageBookingLeadTime,
      previous.bookings.averageBookingLeadTime,
    ),
    cancellationRate: calculateTrend(
      current.bookings.cancellationRate,
      previous.bookings.cancellationRate,
    ),
  };
}
