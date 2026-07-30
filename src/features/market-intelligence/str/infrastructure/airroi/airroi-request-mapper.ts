import type { StrMarketQuery } from "../../domain";

export function mapAirRoiRequest(query: StrMarketQuery, radiusMiles: number) {
  return {
    latitude: query.location.latitude, longitude: query.location.longitude, radius_miles: radiusMiles,
    property_type: query.property.propertyType, bedrooms: query.property.bedrooms, bathrooms: query.property.bathrooms,
    accommodates: query.property.accommodates, entire_place: query.filters?.entirePlaceOnly,
    limit: query.filters?.maximumComparableCount,
  } as const;
}
