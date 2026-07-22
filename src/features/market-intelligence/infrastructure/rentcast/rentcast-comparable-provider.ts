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
  RentCastRentEstimateResponse,
} from "./rentcast-comparable-types";
import type { MarketComparableProvider } from "../../application/providers/market-comparable-provider";
import { mapRentCastMarketComparable } from "./map-rentcast-market-comparable";

export interface RentCastComparableProviderOptions {
  readonly client:
    RentCastClient;
}

export class RentCastComparableProvider
implements ComparableProvider, MarketComparableProvider {
  private readonly client:
    RentCastClient;

  constructor(
    options:
      RentCastComparableProviderOptions,
  ) {
    this.client =
      options.client;
  }

  async acquireComparables(request: Parameters<MarketComparableProvider["acquireComparables"]>[0]): ReturnType<MarketComparableProvider["acquireComparables"]> {
    try {
      const retrievedAt = new Date();
      const subject = request.subject;
      const providerInput = {
        address: subject.address.formatted,
        latitude: subject.coordinates?.latitude,
        longitude: subject.coordinates?.longitude,
        propertyType: request.criteria.propertyTypes[0],
        bedrooms: subject.characteristics.bedrooms,
        bathrooms: subject.characteristics.bathrooms,
        squareFootage: subject.characteristics.squareFeet,
        radiusMiles: request.criteria.radiusMiles,
        daysOld: Math.max(1, Math.ceil((retrievedAt.getTime() - request.criteria.occurredAfter.getTime()) / 86_400_000)),
        compCount: request.criteria.limit,
        lookupSubjectAttributes: true,
      };
      const response = request.purpose === "sale-valuation"
        ? await this.client.requestValueEstimate<RentCastValueEstimateResponse>(providerInput)
        : await this.client.requestLongTermRentEstimate<RentCastRentEstimateResponse>(providerInput);
      if (!response || typeof response !== "object" || (response.comparables !== undefined && !Array.isArray(response.comparables))) throw new ProviderError({ provider: ProviderType.RentCast, code: ProviderErrorCode.InvalidResponse, message: "RentCast returned an invalid comparable collection." });
      const records = response.comparables ?? [];
      return providerSuccess({ provider: ProviderType.RentCast, purpose: request.purpose, retrievedAt, candidates: records.map((record, index) => mapRentCastMarketComparable(record, index + 1)) });
    } catch (error) { return providerFailure(normalizeProviderError(error)); }
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
