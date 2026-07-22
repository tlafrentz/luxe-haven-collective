import type { PropertyAddress } from "./entities/property-record";
import type { ProviderType } from "./enums/provider-type";
import type { MarketProperty, MarketProviderReference } from "./property-resolution";

export type MarketComparablePurpose = "sale-valuation" | "long-term-rent" | "short-term-rental-performance";
export type MarketListingStatus = "active" | "inactive" | "sold" | "unknown";

export interface MarketNumberRange { readonly minimum: number; readonly maximum: number }

export interface MarketComparableSearchCriteriaInput {
  readonly radiusMiles?: number;
  readonly limit?: number;
  readonly propertyTypes?: readonly string[];
  readonly bedroomRange?: MarketNumberRange;
  readonly bathroomRange?: MarketNumberRange;
  readonly squareFeetRange?: MarketNumberRange;
  readonly occurredAfter?: Date;
  readonly listingStatuses?: readonly MarketListingStatus[];
}

export interface MarketComparableSearchCriteria {
  readonly radiusMiles: number;
  readonly limit: number;
  readonly propertyTypes: readonly string[];
  readonly bedroomRange?: MarketNumberRange;
  readonly bathroomRange?: MarketNumberRange;
  readonly squareFeetRange?: MarketNumberRange;
  readonly occurredAfter: Date;
  readonly listingStatuses: readonly MarketListingStatus[];
}

export type MarketComparableDataGapCode =
  | "COMPARABLE_PROPERTY_TYPE_MISSING" | "COMPARABLE_BEDROOM_COUNT_MISSING"
  | "COMPARABLE_BATHROOM_COUNT_MISSING" | "COMPARABLE_SQUARE_FOOTAGE_MISSING"
  | "COMPARABLE_COORDINATES_MISSING" | "COMPARABLE_PRICE_MISSING"
  | "COMPARABLE_TRANSACTION_DATE_MISSING" | "COMPARABLE_LISTING_STATUS_MISSING"
  | "COMPARABLE_RENT_MISSING" | "COMPARABLE_PROVIDER_TIMESTAMP_MISSING"
  | "COMPARABLE_CONFLICTING_PROVIDER_RECORD";

export interface MarketComparableDataGap {
  readonly code: MarketComparableDataGapCode;
  readonly description: string;
  readonly severity: "informational" | "material";
}

export interface MarketComparableProvenance {
  readonly provider: ProviderType;
  readonly externalId?: string;
  readonly dataset: "sale-avm-comparables" | "long-term-rent-avm-comparables";
  readonly retrievedAt?: Date;
  readonly sourceRank?: number;
}

export interface MarketComparableCandidate {
  readonly id: string;
  readonly purpose: MarketComparablePurpose;
  readonly providerReferences: readonly MarketProviderReference[];
  readonly address: Readonly<PropertyAddress>;
  readonly propertyType?: string;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly squareFeet?: number;
  readonly yearBuilt?: number;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly distanceMiles?: number;
  readonly transaction?: Readonly<{ price: number; occurredAt?: Date; pricePerSquareFoot?: number; transactionType?: string }>;
  readonly listing?: Readonly<{ price: number; status: MarketListingStatus; listedAt?: Date; daysOnMarket?: number }>;
  readonly rental?: Readonly<{ monthlyRent: number; status?: MarketListingStatus; listedAt?: Date; daysOnMarket?: number }>;
  readonly sourceRank?: number;
  readonly dataGaps: readonly MarketComparableDataGap[];
  readonly provenance: readonly MarketComparableProvenance[];
}

export interface MarketComparableAcquisitionContext { readonly acquisitionId: string; readonly requestedAt: Date; readonly requestedBy?: string }
export interface AcquireMarketComparablesCommand { readonly subject: MarketProperty; readonly purpose: MarketComparablePurpose; readonly criteria?: MarketComparableSearchCriteriaInput; readonly context: MarketComparableAcquisitionContext }
export type MarketComparableAcquisitionStatus = "acquired" | "empty" | "unsupported";

export interface MarketComparableAcquisitionResult {
  readonly acquisitionId: string;
  readonly subjectId: string;
  readonly purpose: MarketComparablePurpose;
  readonly criteria: MarketComparableSearchCriteria;
  readonly status: MarketComparableAcquisitionStatus;
  readonly candidates: readonly MarketComparableCandidate[];
  readonly excludedSubjectCandidateIds: readonly string[];
  readonly dataGaps: readonly MarketComparableDataGap[];
  readonly provenance: readonly MarketComparableProvenance[];
  readonly requestedAt: Date;
  readonly completedAt: Date;
}

export type MarketPropertyProviderSubject = Pick<MarketProperty, "id" | "providerReferences" | "address" | "characteristics" | "coordinates">;
