import {
  buildDailyOccupancySeries,
  calculateTrend,
  type AnalyticsQueryParams,
} from "@/features/analytics";

import type {
  PerformanceComparison,
  RevenueIntelligence,
  RevenueIntelligenceReport,
} from "../types";

import {
  calculatePropertyPerformance,
} from "./calculate-property-performance";

import {
  loadRevenueIntelligenceInputs,
} from "./load-revenue-intelligence-inputs";

import {
  runOpportunityEngine,
} from "./run-opportunity-engine";

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

export async function getRevenueIntelligence({
  propertyId,
  startDate,
  endDate,
  detectedAt = new Date().toISOString(),
}: AnalyticsQueryParams & {
  detectedAt?: string;
}): Promise<RevenueIntelligence> {
  const inputs =
    await loadRevenueIntelligenceInputs({
      propertyId,
      startDate,
      endDate,
    });

  const current =
    calculatePropertyPerformance({
      bookings: inputs.currentBookings,
      propertyCount: inputs.propertyCount,
      propertyId:
        inputs.selectedPropertyId,
      dateRange: inputs.dateRange,
    });

  const previous =
    calculatePropertyPerformance({
      bookings: inputs.previousBookings,
      propertyCount: inputs.propertyCount,
      propertyId:
        inputs.selectedPropertyId,
      dateRange: inputs.previousDateRange,
    });

  const occupancySeries =
    buildDailyOccupancySeries({
      bookings: inputs.currentBookings,
      dateRange: inputs.dateRange,
      propertyCount: inputs.propertyCount,
    });

  const report: RevenueIntelligenceReport = {
    current,
    previous,
    comparison: buildPerformanceComparison({
      current,
      previous,
    }),
    properties: inputs.properties,
    selectedProperty:
      inputs.selectedProperty,
    dateRange: inputs.dateRange,
    previousDateRange:
      inputs.previousDateRange,
  };

  const opportunityReport =
    runOpportunityEngine({
      context: {
        performance: current,
        previousPerformance: previous,
        bookings: inputs.currentBookings,
        occupancySeries,
        detectedAt,
      },
    });

  return {
    report,
    opportunityReport,
    bookings: inputs.currentBookings,
    occupancySeries,
    generatedAt: detectedAt,
  };
}
