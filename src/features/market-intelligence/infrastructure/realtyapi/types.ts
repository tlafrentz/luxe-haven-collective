/**
 * The published RealtyAPI OpenAPI 3.1 document defines authentication and
 * operations, but leaves successful response schemas empty. These DTOs therefore
 * describe only the fields consumed by this adapter; unknown provider fields stay
 * contained here.
 */
export type RealtyApiJsonObject = Readonly<Record<string, unknown>>;

export interface RealtyApiSuggestionDto extends RealtyApiJsonObject {
  readonly property_id?: string | number;
  readonly listing_id?: string | number;
  readonly id?: string | number;
  readonly area_type?: string;
  readonly display_name?: string;
  readonly full_address?: string;
  readonly line?: string;
  readonly city?: string;
  readonly state_code?: string;
  readonly postal_code?: string;
  readonly address?: unknown;
  readonly centroid?: unknown;
}

export interface RealtyApiPropertyDto extends RealtyApiJsonObject {
  readonly property_id?: string | number;
  readonly listing_id?: string | number;
  readonly address?: unknown;
  readonly location?: unknown;
  readonly description?: unknown;
  readonly list_price?: unknown;
  readonly status?: unknown;
  readonly last_sold_price?: unknown;
  readonly last_sold_date?: unknown;
}

export type RealtyApiAutocompleteResponseDto =
  | readonly RealtyApiSuggestionDto[]
  | RealtyApiJsonObject;

export type RealtyApiPropertyResponseDto = RealtyApiPropertyDto | RealtyApiJsonObject;
