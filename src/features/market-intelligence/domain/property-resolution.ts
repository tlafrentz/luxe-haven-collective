import type { PropertyAddress, PropertyCharacteristics, PropertyCoordinates, PropertyFinancialFacts } from "./entities/property-record";
import type { ProviderType } from "./enums/provider-type";

export interface MarketPropertyLookupAddress {
  readonly streetAddress: string;
  readonly city: string;
  readonly state: string;
  readonly postalCode: string;
  readonly countryCode?: string;
}

export interface NormalizedMarketAddress {
  readonly display: Readonly<Required<Pick<PropertyAddress, "formatted">> & Omit<PropertyAddress, "formatted">>;
  readonly comparisonKey: string;
  readonly unit?: string;
}

export interface MarketProviderReference {
  readonly provider: ProviderType;
  readonly externalId: string;
}

export interface MarketProperty {
  readonly id: string;
  readonly providerReferences: readonly MarketProviderReference[];
  readonly address: Readonly<PropertyAddress>;
  readonly characteristics: Readonly<PropertyCharacteristics>;
  readonly financialFacts: Readonly<PropertyFinancialFacts>;
  readonly coordinates?: Readonly<PropertyCoordinates>;
}

export type MarketPropertyMatchReason =
  | "exact-address"
  | "normalized-address"
  | "city-match"
  | "state-match"
  | "postal-code-match"
  | "unit-match";

export type MarketPropertyMismatch =
  | "street"
  | "unit"
  | "city"
  | "state"
  | "postal-code";

export interface MarketPropertyResolutionCandidate {
  readonly property: MarketProperty;
  readonly matchScore: number;
  readonly matchReasons: readonly MarketPropertyMatchReason[];
  readonly mismatches: readonly MarketPropertyMismatch[];
}

export type MarketPropertyResolutionStatus = "resolved" | "ambiguous" | "not-found" | "unsupported";

export interface MarketPropertyResolutionConfidence {
  readonly score: number;
  readonly level: "high" | "medium" | "low" | "none";
  readonly reasons: readonly string[];
}

export type MarketPropertyDataGapCode =
  | "PROPERTY_TYPE_MISSING"
  | "BEDROOM_COUNT_MISSING"
  | "BATHROOM_COUNT_MISSING"
  | "SQUARE_FOOTAGE_MISSING"
  | "YEAR_BUILT_MISSING"
  | "COORDINATES_MISSING"
  | "UNIT_UNRESOLVED"
  | "PROVIDER_TIMESTAMP_MISSING";

export interface MarketPropertyDataGap {
  readonly code: MarketPropertyDataGapCode;
  readonly description: string;
  readonly severity: "informational" | "material" | "blocking";
  readonly sourceField?: string;
}

export interface MarketPropertyObservationProvenance {
  readonly provider: ProviderType;
  readonly externalId?: string;
  readonly retrievedAt?: Date;
  readonly sampleSize?: number;
  readonly notes?: string;
  readonly normalizationVersion?: string;
}

interface MarketPropertyResolutionResultBase {
  readonly resolutionId: string;
  readonly requestedAddress: MarketPropertyLookupAddress;
  readonly normalizedAddress: NormalizedMarketAddress;
  readonly alternatives: readonly MarketPropertyResolutionCandidate[];
  readonly confidence: MarketPropertyResolutionConfidence;
  readonly dataGaps: readonly MarketPropertyDataGap[];
  readonly provenance: readonly MarketPropertyObservationProvenance[];
  readonly resolvedAt: Date;
}

export type MarketPropertyResolutionResult =
  | (MarketPropertyResolutionResultBase & Readonly<{ status: "resolved"; property: MarketProperty }>)
  | (MarketPropertyResolutionResultBase & Readonly<{ status: "ambiguous" | "not-found" | "unsupported"; property?: never }>);
