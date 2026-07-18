// Application

export {
  RentCastClient,
} from "./infrastructure/rentcast/rentcast-client";

export {
  RentCastPropertyProvider,
} from "./infrastructure/rentcast/rentcast-property-provider";

export {
  mapRentCastProperty,
} from "./infrastructure/rentcast/map-rentcast-property";

export type {
  RentCastClientOptions,
  RentCastPropertySearchInput,
} from "./infrastructure/rentcast/rentcast-client";

export type {
  RentCastPropertyProviderOptions,
} from "./infrastructure/rentcast/rentcast-property-provider";

export type {
  RentCastPropertyRecord,
  RentCastPropertyResponse,
  RentCastPropertyTax,
  RentCastTaxAssessment,
} from "./infrastructure/rentcast/rentcast-types";

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
