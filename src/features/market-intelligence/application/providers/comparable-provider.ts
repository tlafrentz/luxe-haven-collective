import type {
  ComparableProperty,
} from "../../domain/entities/comparable-property";

import type {
  ProviderResult,
} from "./provider-result";

export interface ComparableLookupRequest {
  readonly address: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly squareFeet?: number;
  readonly radiusMiles?: number;
  readonly limit?: number;
}

export interface ComparableProvider {
  getComparables(
    request: ComparableLookupRequest,
  ): Promise<
    ProviderResult<
      readonly ComparableProperty[]
    >
  >;
}
