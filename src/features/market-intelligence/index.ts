// Application

export { buildCanonicalMarketAnalysis, buildMarketAnalysisReport } from "./application";
export type { BuildMarketAnalysisReportInput, CanonicalMarketAnalysis } from "./application";
export { resolveMarketProperty } from "./application";
export type { ResolveMarketPropertyCommand, ResolveMarketPropertyDependencies, MarketPropertyResolutionContext } from "./application";
export type {
  MarketProperty, MarketPropertyDataGap, MarketPropertyLookupAddress,
  MarketPropertyObservationProvenance, MarketPropertyResolutionCandidate,
  MarketPropertyResolutionConfidence, MarketPropertyResolutionResult,
  MarketPropertyResolutionStatus, MarketProviderReference, NormalizedMarketAddress,
} from "./domain/property-resolution";
export type { MarketPropertyResolutionProvider } from "./application/providers/market-property-resolution-provider";
export { acquireMarketComparables } from "./application";
export type { AcquireMarketComparablesDependencies } from "./application";
export type { MarketComparableProvider } from "./application/providers/market-comparable-provider";
export type { AcquireMarketComparablesCommand, MarketComparableAcquisitionResult, MarketComparableAcquisitionStatus, MarketComparableCandidate, MarketComparableDataGap, MarketComparablePurpose, MarketComparableSearchCriteria, MarketComparableSearchCriteriaInput, MarketListingStatus } from "./domain/comparable-acquisition";

export {
  PropertyRecord,
} from "./domain/entities/property-record";

export type {
  PropertyAddress,
  PropertyCharacteristics,
  PropertyCoordinates,
  PropertyFinancialFacts,
} from "./domain/entities/property-record";

export {
  buildMarketIntelligence,
} from "./application/services/build-market-intelligence";

export {
  mergeProviderResults,
} from "./application/services/merge-provider-results";

export {
  scoreConfidence,
} from "./application/services/score-confidence";

export type {
  MarketProvider,
  MarketSearchRequest,
  ComparableSearchRequest,
  MarketObservationResult,
} from "./application/providers/market-provider";

export type {
  PropertyProvider,
  PropertySearchRequest,
} from "./application/providers/property-provider";

// Domain
export { ComparableProperty } from "./domain/entities/comparable-property";
export { MarketIntelligenceReport } from "./domain/entities/market-intelligence-report";
export { MarketObservation } from "./domain/entities/market-observation";
export { MarketProfile } from "./domain/entities/market-profile";

export { ConfidenceLevel } from "./domain/enums/confidence-level";
export { ProviderType } from "./domain/enums/provider-type";

export { ConfidenceScore } from "./domain/value-objects/confidence-score";
export { DataProvenance } from "./domain/value-objects/data-provenance";

// Future bounded contexts
export * as Property from "./property";
export * as Str from "./str";
export * as Demand from "./demand";
export * as Competition from "./competition";
export * as Location from "./location";
export * as Shared from "./shared";

export {
  MarketObservationProvider,
  marketObservationProvider,
} from "./application/providers/market-observation-provider";

export {
  mapComparableAnalysis,
  mapMarketEvidence,
  mapMarketFindings,
  mapMarketSummary,
  mapMarketValuation,
  mapMarketPlatformArtifacts,
  mapMarketAggregateIntelligence,
} from "./application/mappers";

export { observeComparableProviderResult, observePropertyProviderResult } from "./application/providers";
export type { ObservedProviderResult } from "./application/providers";
export type { MarketPlatformArtifacts } from "./domain/market-platform-artifacts";

export {
  MARKET_OBSERVATION_CAPABILITY,
  MARKET_OBSERVATION_TYPES,
  type MarketObservationType,
} from "./application/types";
