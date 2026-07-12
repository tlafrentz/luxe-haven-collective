import {
  calculateTrend,
  getAnalyticsBookings,
  getAnalyticsProperties,
  getPreviousDateRange,
  type AnalyticsProperty,
  type AnalyticsQueryParams,
} from "@/features/analytics";

import type {
  PerformanceComparison,
  RevenueIntelligenceReport,
} from "../domain/revenue-intelligence-report";

import {
  calculatePropertyPerformance,
} from "./calculate-property-performance";

function resolveSelectedProperty({
  properties,
  propertyId,
}: {
  properties: AnalyticsProperty[];
  propertyId?: string | null;
}): AnalyticsProperty | null {
  if (!propertyId) {
    return null;
  }

  return (
    properties.find(
      (property) => property.id === propertyId,
    ) ?? null
  );
}

function buildPerformanceComparison({
  current,
  previous,
}: {
  current: RevenueIntelligenceReport["current"];
  previous: RevenueIntelligenceReport["previous"];
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

export async function getRevenueIntelligenceReport({
  propertyId,
  startDate,
  endDate,
}: AnalyticsQueryParams): Promise<RevenueIntelligenceReport> {
  const properties =
    await getAnalyticsProperties();

  const selectedProperty =
    resolveSelectedProperty({
      properties,
      propertyId,
    });

  const selectedPropertyId =
    selectedProperty?.id ?? null;

  const propertyCount =
    selectedPropertyId === null
      ? properties.length
      : 1;

  const dateRange = {
    startDate,
    endDate,
  };

  const previousDateRange =
    getPreviousDateRange(dateRange);

  const [
    currentBookings,
    previousBookings,
  ] = await Promise.all([
    getAnalyticsBookings({
      propertyId: selectedPropertyId,
      ...dateRange,
    }),
    getAnalyticsBookings({
      propertyId: selectedPropertyId,
      ...previousDateRange,
    }),
  ]);

  const current =
    calculatePropertyPerformance({
      bookings: currentBookings,
      propertyCount,
      propertyId: selectedPropertyId,
      dateRange,
    });

  const previous =
    calculatePropertyPerformance({
      bookings: previousBookings,
      propertyCount,
      propertyId: selectedPropertyId,
      dateRange: previousDateRange,
    });

  return {
    current,
    previous,
    comparison: buildPerformanceComparison({
      current,
      previous,
    }),
    properties,
    selectedProperty,
    dateRange,
    previousDateRange,
  };
}

