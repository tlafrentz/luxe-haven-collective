import {
  buildDailyOccupancySeries,
  type AnalyticsQueryParams,
} from "@/features/analytics";

import type {
  RevenueIntelligence,
  RevenueIntelligenceReport,
} from "../types";

import {
  buildPerformanceComparison,
} from "../engine/build-performance-comparison";

import {
  calculatePropertyPerformance,
} from "./calculate-property-performance";

import {
  loadRevenueIntelligenceInputs,
} from "./load-revenue-intelligence-inputs";

import {
  runOpportunityEngine,
} from "./run-opportunity-engine";

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
    comparison:
      buildPerformanceComparison({
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
