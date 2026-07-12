export {
  calculatePropertyPerformance,
} from "./services/calculate-property-performance";

export {
  getRevenueIntelligenceReport,
} from "./services/get-revenue-intelligence-report";

export {
  runOpportunityEngine,
} from "./services/run-opportunity-engine";

export {
  deduplicateOpportunities,
  opportunityDetectors,
  sortOpportunities,
  summarizeOpportunities,
} from "./engine";

export {
  OPPORTUNITY_CATEGORIES,
  OPPORTUNITY_TYPES,
} from "./types";

export type {
  BookingBehaviorPerformance,
  BookingPerformance,
  OccupancyPerformance,
  OpportunityAction,
  OpportunityActionType,
  OpportunityCategory,
  OpportunityConfidence,
  OpportunityDateRange,
  OpportunityDetectionContext,
  OpportunityDetector,
  OpportunityEvidence,
  OpportunityEvidenceValue,
  OpportunityImpact,
  OpportunityReport,
  OpportunitySeverity,
  OpportunityStatus,
  OpportunitySummary,
  PerformanceComparison,
  PerformanceScope,
  PropertyPerformance,
  RevenueIntelligenceReport,
  RevenueOpportunity,
  RevenueOpportunityType,
  RevenuePerformance,
} from "./types";
