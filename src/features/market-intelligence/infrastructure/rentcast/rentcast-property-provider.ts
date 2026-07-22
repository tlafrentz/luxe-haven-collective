import type {
  PropertyProvider,
  PropertySearchMatch,
  PropertySearchRequest,
} from "../../application/providers/property-provider";

import {
  ProviderError,
  ProviderErrorCode,
} from "../../application/providers/provider-error";

import {
  providerFailure,
  providerSuccess,
} from "../../application/providers/provider-result";

import type {
  ProviderResult,
} from "../../application/providers/provider-result";

import type {
  PropertyRecord,
} from "../../domain/entities/property-record";

import type { MarketPropertyResolutionProvider } from "../../application/providers/market-property-resolution-provider";

import {
  ProviderType,
} from "../../domain/enums/provider-type";

import {
  RentCastClient,
} from "./rentcast-client";

import {
  mapRentCastProperty,
} from "./map-rentcast-property";

export interface RentCastPropertyProviderOptions {
  readonly client: RentCastClient;
}

export class RentCastPropertyProvider
implements PropertyProvider, MarketPropertyResolutionProvider {
  private readonly client:
    RentCastClient;

  constructor(
    options:
      RentCastPropertyProviderOptions,
  ) {
    this.client = options.client;
  }

  async lookupPropertyCandidates(
    request: Parameters<MarketPropertyResolutionProvider["lookupPropertyCandidates"]>[0],
  ): ReturnType<MarketPropertyResolutionProvider["lookupPropertyCandidates"]> {
    try {
      const retrievedAt = new Date();
      const records = await this.client.searchProperties({
        address: formatLookupAddress(request.address),
        limit: 10,
      });
      if (!Array.isArray(records)) {
        throw new ProviderError({
          provider: ProviderType.RentCast,
          code: ProviderErrorCode.InvalidResponse,
          message: "RentCast returned an invalid property collection.",
        });
      }
      return providerSuccess({
        provider: ProviderType.RentCast,
        retrievedAt,
        candidates: records.map((record) => {
          const property = mapRentCastProperty(record, retrievedAt);
          return { externalId: property.id, property };
        }),
      });
    } catch (error) {
      return providerFailure(normalizeProviderError(error));
    }
  }

  async searchProperties(
    request: PropertySearchRequest,
  ): Promise<
    ProviderResult<
      readonly PropertySearchMatch[]
    >
  > {
    try {
      const records =
        await this.client
          .searchProperties({
            address:
              request.address,
            limit: 10,
          });

      const matches =
        records.flatMap(
          (record) => {
            if (
              !record.id ||
              !record.formattedAddress
            ) {
              return [];
            }

            return [
              {
                providerPropertyId:
                  record.id,
                formattedAddress:
                  record
                    .formattedAddress,
                latitude:
                  record.latitude,
                longitude:
                  record.longitude,
              },
            ];
          },
        );

      return providerSuccess(
        matches,
      );
    } catch (error) {
      return providerFailure(
        normalizeProviderError(
          error,
        ),
      );
    }
  }

  async getProperty(
    request: PropertySearchRequest,
  ): Promise<
    ProviderResult<PropertyRecord>
  > {
    try {
      const records =
        await this.client
          .searchProperties({
            address:
              request.address,
            limit: 1,
          });

      const record = records[0];

      if (!record) {
        return providerFailure(
          new ProviderError({
            provider:
              ProviderType.RentCast,
            code:
              ProviderErrorCode
                .NotFound,
            message:
              `No RentCast property record was found for "${request.address}".`,
          }),
        );
      }

      return providerSuccess(
        mapRentCastProperty(record),
      );
    } catch (error) {
      return providerFailure(
        normalizeProviderError(
          error,
        ),
      );
    }
  }
}

function formatLookupAddress(address: Parameters<MarketPropertyResolutionProvider["lookupPropertyCandidates"]>[0]["address"]): string {
  return `${address.streetAddress.trim()}, ${address.city.trim()}, ${address.state.trim()} ${address.postalCode.trim()}`;
}

function normalizeProviderError(
  error: unknown,
): ProviderError {
  if (
    error instanceof
    ProviderError
  ) {
    return error;
  }

  return new ProviderError({
    provider:
      ProviderType.RentCast,
    code:
      ProviderErrorCode.Unknown,
    message:
      "An unexpected RentCast provider error occurred.",
    retryable: false,
    cause: error,
  });
}
