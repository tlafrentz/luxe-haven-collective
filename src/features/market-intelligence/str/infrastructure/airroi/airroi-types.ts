export interface AirRoiEnvelopeDto<T> { readonly data?: T; readonly request_id?: string; readonly error?: { readonly code?: string; readonly message?: string } }
export interface AirRoiRevenueDto {
  readonly annual_revenue?: unknown; readonly monthly_revenue?: unknown; readonly adr?: unknown;
  readonly occupancy?: unknown; readonly revpar?: unknown; readonly currency?: unknown; readonly confidence?: unknown;
  readonly period_start?: unknown; readonly period_end?: unknown; readonly period_basis?: unknown;
}
export interface AirRoiComparableDto {
  readonly id?: unknown; readonly url?: unknown; readonly latitude?: unknown; readonly longitude?: unknown;
  readonly distance_miles?: unknown; readonly market?: unknown; readonly property_type?: unknown; readonly bedrooms?: unknown;
  readonly bathrooms?: unknown; readonly accommodates?: unknown; readonly room_type?: unknown; readonly amenities?: unknown;
  readonly adr?: unknown; readonly occupancy?: unknown; readonly revpar?: unknown; readonly annual_revenue?: unknown;
  readonly length_of_stay?: unknown; readonly active_days?: unknown; readonly review_count?: unknown; readonly rating?: unknown;
}
export interface AirRoiMarketDto {
  readonly adr?: unknown; readonly occupancy?: unknown; readonly revpar?: unknown; readonly active_listings?: unknown;
  readonly demand_index?: unknown; readonly revenue_growth?: unknown; readonly currency?: unknown;
  readonly monthly?: readonly Record<string, unknown>[];
}
