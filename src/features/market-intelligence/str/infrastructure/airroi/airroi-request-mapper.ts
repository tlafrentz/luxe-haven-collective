import type { StrMarketQuery } from "../../domain";

export function mapAirRoiRequest(query: StrMarketQuery, radiusMiles: number) {
  const bedrooms = query.property.bedrooms ?? 1;
  return {
    lat: query.location.latitude, lng: query.location.longitude,
    latitude: query.location.latitude, longitude: query.location.longitude,
    radius_miles: radiusMiles, bedrooms, baths: query.property.bathrooms ?? 1,
    guests: query.property.accommodates ?? Math.max(1, bedrooms * 2),
    currency: (query.property.currency ?? "USD").toLowerCase(),
  } as const;
}
