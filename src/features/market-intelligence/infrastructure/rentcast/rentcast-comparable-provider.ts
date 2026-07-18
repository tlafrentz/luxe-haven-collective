import type {
  ComparableProvider,
  ComparableLookupRequest,
} from "../../application/providers/comparable-provider";

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
  ComparableProperty,
} from "../../domain/entities/comparable-property";

import {
  ProviderType,
} from "../../domain/enums/provider-type";

import {
  RentCastClient,
} from "./rentcast-client";

import {
  mapRentCastComparable,
} from "./map-rentcast-comparable";

import type {
  RentCastValueEstimateResponse,
} from "./rentcast-comparable-types";

export interface RentCastComparableProviderOptions {
  readonly client:
    RentCastClient;
}

export class RentCastComparableProvider
implements ComparableProvider {
  private readonly client:
    RentCastClient;

  constructor(
    options:
      RentCastComparableProviderOptions,
  ) {
    this.client =
      options.client;
  }

  async getComparables(
    request:
      ComparableLookupRequest,
  ): Promise<
    ProviderResult<
      readonly ComparableProperty[]
    >
  > {
    try {
      const response =
        await this.client
          .requestValueEstimate<
            RentCastValueEstimateResponse
          >({
            address:
              request.address,
            latitude:
              request.latitude,
            longitude:
              request.longitude,
            bedrooms:
              request.bedrooms,
            bathrooms:
              request.bathrooms,
            squareFootage:
              request.squareFeet,
            radiusMiles:
              request.radiusMiles,
            compCount:
              request.limit,
          });

      const comparables =
        (
          response.comparables ??
          []
        )
          .flatMap(
            (record) => {
              try {
                return [
                  mapRentCastComparable(
                    record,
                  ),
                ];
              } catch {
                return [];
              }
            },
          );

      if (
        comparables.length === 0
      ) {
        return providerFailure(
          new ProviderError({
            provider:
              ProviderType.RentCast,
            code:
              ProviderErrorCode
                .NotFound,
            message:
              `No comparable properties were found for "${request.address}".`,
          }),
        );
      }

      return providerSuccess(
        comparables,
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
      "An unexpected RentCast comparable provider error occurred.",
    cause: error,
  });
}
