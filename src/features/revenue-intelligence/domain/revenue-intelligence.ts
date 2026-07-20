import type {
  AnalyticsBooking,
  OccupancyDataPoint,
} from "./revenue-input";

import type {
  OpportunityReport,
} from "./opportunity-report";

import type {
  RevenueIntelligenceReport,
} from "./revenue-intelligence-report";
import type { RevenueReasoningArtifacts } from "./revenue-reasoning-artifacts";

export type RevenueIntelligence = {
  report: RevenueIntelligenceReport;
  opportunityReport: OpportunityReport;
  bookings: AnalyticsBooking[];
  occupancySeries: OccupancyDataPoint[];
  generatedAt: string;
  reasoning?: RevenueReasoningArtifacts;
};
