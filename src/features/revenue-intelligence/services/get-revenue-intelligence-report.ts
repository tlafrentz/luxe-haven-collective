import type {
  AnalyticsQueryParams,
} from "../domain/revenue-input";

import type {
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

export async function getRevenueIntelligenceReport(
  params: AnalyticsQueryParams,
): Promise<RevenueIntelligenceReport> {
  const inputs =
    await loadRevenueIntelligenceInputs(params);

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

  return {
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
}
