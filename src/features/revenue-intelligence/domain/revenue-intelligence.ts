import type {
  AnalyticsBooking,
  OccupancyDataPoint,
} from "@/features/analytics";

import type {
  OpportunityReport,
} from "./opportunity-report";

import type {
  RevenueIntelligenceReport,
} from "./revenue-intelligence-report";

export type RevenueIntelligence = {
  report: RevenueIntelligenceReport;
  opportunityReport: OpportunityReport;
  bookings: AnalyticsBooking[];
  occupancySeries: OccupancyDataPoint[];
  generatedAt: string;
};
