import {
  ProviderError,
  ProviderErrorCode,
} from "../../application/providers/provider-error";

import {
  ProviderType,
} from "../../domain/enums/provider-type";

import type {
  RentCastPropertyResponse,
} from "./rentcast-types";

const DEFAULT_BASE_URL =
  "https://api.rentcast.io/v1";

const DEFAULT_TIMEOUT_MS = 10_000;

export interface RentCastClientOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

export interface RentCastPropertySearchInput {
  readonly address: string;
  readonly limit?: number;
}

export interface RentCastValueEstimateInput {
  readonly address?: string;
  readonly latitude?: number;
  readonly longitude?: number;
  readonly propertyType?: string;
  readonly bedrooms?: number;
  readonly bathrooms?: number;
  readonly squareFootage?: number;
  readonly radiusMiles?: number;
  readonly daysOld?: number;
  readonly compCount?: number;
  readonly lookupSubjectAttributes?: boolean;
}

export class RentCastClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImplementation:
    typeof fetch;

  constructor(
    options: RentCastClientOptions,
  ) {
    const apiKey = options.apiKey.trim();

    if (!apiKey) {
      throw new ProviderError({
        provider: ProviderType.RentCast,
        code: ProviderErrorCode.NotConfigured,
        message: "RentCast API key is required.",
      });
    }

    this.apiKey = apiKey;
    this.baseUrl =
      options.baseUrl?.replace(
        /\/+$/,
        "",
      ) ?? DEFAULT_BASE_URL;

    this.timeoutMs =
      options.timeoutMs ??
      DEFAULT_TIMEOUT_MS;

    this.fetchImplementation =
      options.fetchImplementation ??
      fetch;
  }

  async searchProperties(
    input: RentCastPropertySearchInput,
  ): Promise<RentCastPropertyResponse> {
    const address = input.address.trim();

    if (!address) {
      throw new ProviderError({
        provider:
          ProviderType.RentCast,
        code:
          ProviderErrorCode
            .InvalidRequest,
        message:
          "A property address is required.",
      });
    }

    const url = new URL(
      `${this.baseUrl}/properties`,
    );

    url.searchParams.set(
      "address",
      address,
    );

    url.searchParams.set(
      "limit",
      String(input.limit ?? 10),
    );

    return this.request<
      RentCastPropertyResponse
    >(url);
  }

  async requestValueEstimate<T>(
    input: RentCastValueEstimateInput,
  ): Promise<T> {
    const address =
      input.address?.trim();

    const hasAddress =
      Boolean(address);

    const hasCoordinates =
      input.latitude !== undefined &&
      input.longitude !== undefined;

    if (!hasAddress && !hasCoordinates) {
      throw new ProviderError({
        provider:
          ProviderType.RentCast,
        code:
          ProviderErrorCode
            .InvalidRequest,
        message:
          "A property address or latitude and longitude are required.",
      });
    }

    if (
      (input.latitude === undefined) !==
      (input.longitude === undefined)
    ) {
      throw new ProviderError({
        provider:
          ProviderType.RentCast,
        code:
          ProviderErrorCode
            .InvalidRequest,
        message:
          "Latitude and longitude must be provided together.",
      });
    }

    const url = new URL(
      `${this.baseUrl}/avm/value`,
    );

    setOptionalSearchParameter(
      url,
      "address",
      address,
    );

    setOptionalSearchParameter(
      url,
      "latitude",
      input.latitude,
    );

    setOptionalSearchParameter(
      url,
      "longitude",
      input.longitude,
    );

    setOptionalSearchParameter(
      url,
      "propertyType",
      input.propertyType,
    );

    setOptionalSearchParameter(
      url,
      "bedrooms",
      input.bedrooms,
    );

    setOptionalSearchParameter(
      url,
      "bathrooms",
      input.bathrooms,
    );

    setOptionalSearchParameter(
      url,
      "squareFootage",
      input.squareFootage,
    );

    setOptionalSearchParameter(
      url,
      "maxRadius",
      input.radiusMiles,
    );

    setOptionalSearchParameter(
      url,
      "daysOld",
      input.daysOld,
    );

    setOptionalSearchParameter(
      url,
      "compCount",
      input.compCount,
    );

    setOptionalSearchParameter(
      url,
      "lookupSubjectAttributes",
      input.lookupSubjectAttributes,
    );

    return this.request<T>(url);
  }

  private async request<T>(
    url: URL,
  ): Promise<T> {
    const controller =
      new AbortController();

    const timeout = setTimeout(
      () => controller.abort(),
      this.timeoutMs,
    );

    try {
      const response =
        await this.fetchImplementation(
          url,
          {
            method: "GET",
            headers: {
              Accept:
                "application/json",
              "X-Api-Key":
                this.apiKey,
            },
            signal:
              controller.signal,
          },
        );

      if (!response.ok) {
        throw createHttpProviderError(
          response.status,
        );
      }

      try {
        return await response.json() as T;
      } catch (error) {
        throw new ProviderError({
          provider:
            ProviderType.RentCast,
          code:
            ProviderErrorCode
              .InvalidResponse,
          message:
            "RentCast returned an invalid JSON response.",
          cause: error,
        });
      }
    } catch (error) {
      if (
        error instanceof
        ProviderError
      ) {
        throw error;
      }

      if (
        error instanceof Error &&
        error.name === "AbortError"
      ) {
        throw new ProviderError({
          provider:
            ProviderType.RentCast,
          code:
            ProviderErrorCode
              .TimedOut,
          message:
            "The RentCast request timed out.",
          retryable: true,
          cause: error,
        });
      }

      throw new ProviderError({
        provider:
          ProviderType.RentCast,
        code:
          ProviderErrorCode
            .RequestFailed,
        message:
          "The RentCast request failed.",
        retryable: true,
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

function setOptionalSearchParameter(
  url: URL,
  key: string,
  value:
    | string
    | number
    | boolean
    | undefined,
): void {
  if (value === undefined || value === "") {
    return;
  }

  url.searchParams.set(
    key,
    String(value),
  );
}

function createHttpProviderError(
  statusCode: number,
): ProviderError {
  if (statusCode === 400) {
    return new ProviderError({
      provider:
        ProviderType.RentCast,
      code:
        ProviderErrorCode
          .InvalidRequest,
      message:
        "RentCast rejected the request.",
      statusCode,
    });
  }

  if (statusCode === 401) {
    return new ProviderError({
      provider:
        ProviderType.RentCast,
      code:
        ProviderErrorCode
          .AuthenticationFailed,
      message:
        "RentCast authentication failed.",
      statusCode,
    });
  }

  if (statusCode === 403) {
    return new ProviderError({
      provider:
        ProviderType.RentCast,
      code:
        ProviderErrorCode
          .AccessDenied,
      message:
        "RentCast denied access to the requested resource.",
      statusCode,
    });
  }

  if (statusCode === 404) {
    return new ProviderError({
      provider:
        ProviderType.RentCast,
      code:
        ProviderErrorCode.NotFound,
      message:
        "The requested RentCast resource was not found.",
      statusCode,
    });
  }

  if (statusCode === 429) {
    return new ProviderError({
      provider:
        ProviderType.RentCast,
      code:
        ProviderErrorCode
          .RateLimited,
      message:
        "RentCast rate limit reached.",
      retryable: true,
      statusCode,
    });
  }

  if (statusCode >= 500) {
    return new ProviderError({
      provider:
        ProviderType.RentCast,
      code:
        ProviderErrorCode
          .Unavailable,
      message:
        "RentCast is temporarily unavailable.",
      retryable: true,
      statusCode,
    });
  }

  return new ProviderError({
    provider:
      ProviderType.RentCast,
    code:
      ProviderErrorCode.Unknown,
    message:
      `RentCast returned HTTP ${statusCode}.`,
    statusCode,
  });
}
