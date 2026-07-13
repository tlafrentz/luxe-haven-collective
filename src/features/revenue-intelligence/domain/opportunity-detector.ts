import type {
  AnalyticsBooking,
  OccupancyDataPoint,
} from "@/features/analytics";

import type {
  PropertyPerformance,
} from "./property-performance";

import type {
  RevenueOpportunity,
  RevenueOpportunityType,
} from "./revenue-opportunity";

export type OpportunityDetectionContext = {
  performance: PropertyPerformance;
  previousPerformance?: PropertyPerformance;
  bookings: AnalyticsBooking[];
  occupancySeries?: OccupancyDataPoint[];
  detectedAt: string;
};

export type OpportunityDetector = {
  id: string;
  opportunityTypes: readonly RevenueOpportunityType[];
  detect: (
    context: OpportunityDetectionContext,
  ) => RevenueOpportunity[];
};
