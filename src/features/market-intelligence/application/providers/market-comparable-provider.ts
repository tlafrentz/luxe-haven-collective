import type { PropertyAddress } from "../../domain/entities/property-record";
import type { ProviderType } from "../../domain/enums/provider-type";
import type { MarketComparablePurpose, MarketComparableSearchCriteria, MarketListingStatus, MarketPropertyProviderSubject } from "../../domain/comparable-acquisition";
import type { ProviderResult } from "./provider-result";

export interface MarketComparableProviderCandidate {
  readonly externalId: string;
  readonly address: PropertyAddress;
  readonly propertyType?: string;
  readonly bedrooms?: number; readonly bathrooms?: number; readonly squareFeet?: number; readonly yearBuilt?: number;
  readonly latitude?: number; readonly longitude?: number; readonly distanceMiles?: number;
  readonly price?: number; readonly listedAt?: Date; readonly daysOnMarket?: number; readonly listingStatus?: MarketListingStatus;
  readonly sourceRank?: number;
}

export interface MarketComparableProviderResult {
  readonly provider: ProviderType;
  readonly purpose: Exclude<MarketComparablePurpose, "short-term-rental-performance">;
  readonly candidates: readonly MarketComparableProviderCandidate[];
  readonly retrievedAt?: Date;
}

export interface MarketComparableProvider {
  acquireComparables(request: Readonly<{ subject: MarketPropertyProviderSubject; purpose: Exclude<MarketComparablePurpose, "short-term-rental-performance">; criteria: MarketComparableSearchCriteria }>): Promise<ProviderResult<MarketComparableProviderResult>>;
}
