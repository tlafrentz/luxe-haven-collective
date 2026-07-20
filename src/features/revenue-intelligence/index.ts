export {
  calculatePropertyPerformance,
} from "./services/calculate-property-performance";

export {
  getRevenueIntelligence,
} from "./services/get-revenue-intelligence";

export {
  getRevenueIntelligenceReport,
} from "./services/get-revenue-intelligence-report";

export {
  runOpportunityEngine,
} from "./services/run-opportunity-engine";

export {
  bookingSourceConcentrationOpportunityDetector,
  cancellationsOpportunityDetector,
  gapNightOpportunityDetector,
  lowWeekdayOccupancyOpportunityDetector,
  paymentsOpportunityDetector,
  weekendPricingOpportunityDetector,
} from "./detectors";

export {
  buildPerformanceComparison,
  deduplicateOpportunities,
  opportunityDetectors,
  sortOpportunities,
  summarizeOpportunities,
} from "./engine";

export {
  REVENUE_OBSERVATION_CAPABILITY,
  REVENUE_OBSERVATION_TYPES,
  RevenueObservationProvider,
  revenueObservationProvider,
  toRevenueReasoningArtifacts,
  decideRevenueRecommendation,
  projectOpportunityStatus,
  recordRevenueOutcome,
} from "./application";

export {
  OpportunityCard,
  OpportunityIntelligence,
  RevenueIntelligenceDashboard,
} from "./components";

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
  RevenueIntelligence,
  RevenueIntelligenceReport,
  RevenueOpportunity,
  RevenueOpportunityType,
  RevenuePerformance,
} from "./types";

export type { RevenueDecisionResult, RevenueRecommendationDisposition } from "./application";
export type { RevenueReasoningArtifacts } from "./domain/revenue-reasoning-artifacts";
