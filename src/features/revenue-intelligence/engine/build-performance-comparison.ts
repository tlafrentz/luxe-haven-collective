import { revenueAnalyticsGateway } from "../adapters/analytics-input-adapter";

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
    grossRevenue: revenueAnalyticsGateway.trend(
      current.revenue.grossRevenue,
      previous.revenue.grossRevenue,
    ),
    roomRevenue: revenueAnalyticsGateway.trend(
      current.revenue.roomRevenue,
      previous.revenue.roomRevenue,
    ),
    occupancyRate: revenueAnalyticsGateway.trend(
      current.occupancy.occupancyRate,
      previous.occupancy.occupancyRate,
    ),
    averageDailyRate: revenueAnalyticsGateway.trend(
      current.revenue.averageDailyRate,
      previous.revenue.averageDailyRate,
    ),
    revPar: revenueAnalyticsGateway.trend(
      current.revenue.revPar,
      previous.revenue.revPar,
    ),
    averageLengthOfStay: revenueAnalyticsGateway.trend(
      current.bookings.averageLengthOfStay,
      previous.bookings.averageLengthOfStay,
    ),
    averageBookingLeadTime: revenueAnalyticsGateway.trend(
      current.bookings.averageBookingLeadTime,
      previous.bookings.averageBookingLeadTime,
    ),
    cancellationRate: revenueAnalyticsGateway.trend(
      current.bookings.cancellationRate,
      previous.bookings.cancellationRate,
    ),
  };
}
