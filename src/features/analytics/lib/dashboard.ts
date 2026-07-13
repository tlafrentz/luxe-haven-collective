import type {
  AnalyticsQueryParams,
  DashboardAnalytics,
  DashboardComparison,
} from "../types";

import {
  calculateDashboardMetrics,
} from "./calculations";

import {
  calculateTrend,
  getPreviousDateRange,
} from "./comparison";

import {
  getAnalyticsBookings,
  getAnalyticsProperties,
} from "./queries";

export async function getDashboardAnalytics({
  propertyId,
  startDate,
  endDate,
}: AnalyticsQueryParams): Promise<DashboardAnalytics> {
  const properties =
    await getAnalyticsProperties();

  const selectedPropertyId =
    propertyId &&
    properties.some(
      (property) =>
        property.id === propertyId,
    )
      ? propertyId
      : null;

  const previousDateRange =
    getPreviousDateRange({
      startDate,
      endDate,
    });

  const [
    currentBookings,
    previousBookings,
  ] = await Promise.all([
    getAnalyticsBookings({
      propertyId: selectedPropertyId,
      startDate,
      endDate,
    }),
    getAnalyticsBookings({
      propertyId: selectedPropertyId,
      startDate:
        previousDateRange.startDate,
      endDate:
        previousDateRange.endDate,
    }),
  ]);

  const propertyCount =
    selectedPropertyId
      ? 1
      : properties.length;

  const currentMetrics =
    calculateDashboardMetrics({
      bookings: currentBookings,
      propertyCount,
      dateRange: {
        startDate,
        endDate,
      },
    });

  const previousMetrics =
    calculateDashboardMetrics({
      bookings: previousBookings,
      propertyCount,
      dateRange: previousDateRange,
    });

  const comparison: DashboardComparison = {
    revenue: calculateTrend(
      currentMetrics.grossRevenue,
      previousMetrics.grossRevenue,
    ),
    occupancy: calculateTrend(
      currentMetrics.occupancyRate,
      previousMetrics.occupancyRate,
    ),
    adr: calculateTrend(
      currentMetrics.averageDailyRate,
      previousMetrics.averageDailyRate,
    ),
    revPar: calculateTrend(
      currentMetrics.revPar,
      previousMetrics.revPar,
    ),
  };

  return {
    metrics: currentMetrics,
    previousMetrics,
    comparison,
    bookings: currentBookings,
    properties,
    dateRange: {
      startDate,
      endDate,
    },
    previousDateRange,
    selectedPropertyId,
  };
}
