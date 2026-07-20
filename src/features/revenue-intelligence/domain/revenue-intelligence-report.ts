import type {
  AnalyticsDateRange,
  AnalyticsProperty,
  MetricTrend,
} from "./revenue-input";

import type {
  PropertyPerformance,
} from "./property-performance";

export type PerformanceComparison = {
  grossRevenue: MetricTrend;
  roomRevenue: MetricTrend;
  occupancyRate: MetricTrend;
  averageDailyRate: MetricTrend;
  revPar: MetricTrend;
  averageLengthOfStay: MetricTrend;
  averageBookingLeadTime: MetricTrend;
  cancellationRate: MetricTrend;
};

export type RevenueIntelligenceReport = {
  current: PropertyPerformance;
  previous: PropertyPerformance;
  comparison: PerformanceComparison;
  properties: AnalyticsProperty[];
  selectedProperty: AnalyticsProperty | null;
  dateRange: AnalyticsDateRange;
  previousDateRange: AnalyticsDateRange;
};
