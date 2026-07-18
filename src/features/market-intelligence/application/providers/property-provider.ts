import type {
  PropertyRecord,
} from "../../domain/entities/property-record";

import type {
  ProviderResult,
} from "./provider-result";

export interface PropertySearchRequest {
  readonly address: string;
}

export interface PropertySearchMatch {
  readonly providerPropertyId: string;
  readonly formattedAddress: string;
  readonly latitude?: number;
  readonly longitude?: number;
}

export interface PropertyProvider {
  searchProperties(
    request: PropertySearchRequest,
  ): Promise<
    ProviderResult<
      readonly PropertySearchMatch[]
    >
  >;

  getProperty(
    request: PropertySearchRequest,
  ): Promise<
    ProviderResult<PropertyRecord>
  >;
}
