import { buildDailyOccupancySeries, calculateDashboardMetrics, calculateTrend, differenceInNights, getAnalyticsBookings, getAnalyticsProperties, getPreviousDateRange } from "@/features/analytics";
import type { RevenueBooking, RevenueDateRange, RevenueProperty } from "../domain/revenue-input";

export const revenueAnalyticsGateway = {
  loadBookings: getAnalyticsBookings as (input: RevenueDateRange & { propertyId?: string | null }) => Promise<RevenueBooking[]>,
  loadProperties: getAnalyticsProperties as () => Promise<RevenueProperty[]>,
  previousDateRange: getPreviousDateRange,
  dailyOccupancy: buildDailyOccupancySeries,
  dashboardMetrics: calculateDashboardMetrics,
  trend: calculateTrend,
  differenceInNights,
} as const;
