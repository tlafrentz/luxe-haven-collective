export interface RentCastComparableRecord {
  readonly id?: string;
  readonly formattedAddress?: string;
  readonly addressLine1?: string;
  readonly city?: string;
  readonly state?: string;
  readonly zipCode?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly propertyType?: string;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly squareFootage?: number;
  readonly yearBuilt?: number;
  readonly price?: number;
  readonly listingType?: string;
  readonly status?: string;
  readonly listedDate?: string;
  readonly removedDate?: string;
  readonly daysOnMarket?: number;
  readonly distance?: number;
  readonly correlation?: number;
}

export interface RentCastValueEstimateResponse {
  readonly price?: number;
  readonly priceRangeLow?: number;
  readonly priceRangeHigh?: number;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly comparables?:
    readonly RentCastComparableRecord[];
}

export interface RentCastRentEstimateResponse {
  readonly rent?: number;
  readonly rentRangeLow?: number;
  readonly rentRangeHigh?: number;
  readonly comparables?: readonly RentCastComparableRecord[];
}
