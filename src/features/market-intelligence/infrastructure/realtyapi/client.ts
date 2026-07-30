import { ProviderErrorCode } from "../../application/providers/provider-error";
import { REALTY_API_BASE_URL, REALTY_API_ENDPOINTS } from "./endpoints";
import { RealtyApiError } from "./errors";
import type {
  RealtyApiAutocompleteResponseDto,
  RealtyApiPropertyResponseDto,
} from "./types";

export interface RealtyApiClientOptions {
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
  readonly fetchImplementation?: typeof fetch;
}

export class RealtyApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImplementation: typeof fetch;

  constructor(options: RealtyApiClientOptions) {
    this.apiKey = options.apiKey.trim();
    if (!this.apiKey) {
      throw new RealtyApiError({
        code: ProviderErrorCode.NotConfigured,
        message: "REALTY_API_KEY is required.",
      });
    }
    this.baseUrl = (options.baseUrl ?? REALTY_API_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 10_000;
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  autocomplete(input: string, limit = 10): Promise<RealtyApiAutocompleteResponseDto> {
    const normalized = input.trim();
    if (!normalized) {
      throw new RealtyApiError({
        code: ProviderErrorCode.InvalidRequest,
        message: "A property address is required.",
      });
    }
    return this.get(REALTY_API_ENDPOINTS.autocomplete, { input: normalized, limit });
  }

  getDetailsById(propertyId: string, listingId?: string): Promise<RealtyApiPropertyResponseDto> {
    const id = propertyId.trim();
    if (!id) {
      throw new RealtyApiError({
        code: ProviderErrorCode.InvalidRequest,
        message: "A RealtyAPI property id is required.",
      });
    }
    return this.get(REALTY_API_ENDPOINTS.detailsById, {
      property_id: id,
      ...(listingId ? { listing_id: listingId } : {}),
    });
  }

  getDetailsByAddress(address: string): Promise<RealtyApiPropertyResponseDto> {
    const normalized = address.trim();
    if (!normalized) {
      throw new RealtyApiError({
        code: ProviderErrorCode.InvalidRequest,
        message: "A property address is required.",
      });
    }
    return this.get(REALTY_API_ENDPOINTS.detailsByAddress, { address: normalized });
  }

  private async get<T>(path: string, parameters: Readonly<Record<string, string | number>>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, String(value));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImplementation(url, {
        method: "GET",
        headers: { Accept: "application/json", "x-realtyapi-key": this.apiKey },
        signal: controller.signal,
      });
      if (!response.ok) throw await responseError(response);
      try {
        return await response.json() as T;
      } catch (cause) {
        throw new RealtyApiError({
          code: ProviderErrorCode.InvalidResponse,
          message: "RealtyAPI returned invalid JSON.",
          statusCode: response.status,
          cause,
        });
      }
    } catch (error) {
      if (error instanceof RealtyApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new RealtyApiError({
          code: ProviderErrorCode.TimedOut,
          message: "RealtyAPI request timed out.",
          retryable: true,
          cause: error,
        });
      }
      throw new RealtyApiError({
        code: ProviderErrorCode.RequestFailed,
        message: "RealtyAPI request failed.",
        retryable: true,
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function responseError(response: Response): Promise<RealtyApiError> {
  const code = response.status === 401 ? ProviderErrorCode.AuthenticationFailed
    : response.status === 402 ? ProviderErrorCode.AccessDenied
      : response.status === 404 ? ProviderErrorCode.NotFound
        : response.status === 429 ? ProviderErrorCode.RateLimited
          : response.status >= 500 ? ProviderErrorCode.Unavailable
            : ProviderErrorCode.RequestFailed;
  let providerMessage: string | undefined;
  try {
    const body = await response.json() as { error?: unknown };
    if (typeof body.error === "string") providerMessage = body.error;
  } catch {
    // Status is sufficient to normalize the error.
  }
  return new RealtyApiError({
    code,
    message: providerMessage ? `RealtyAPI request failed: ${providerMessage}` : `RealtyAPI request failed with HTTP ${response.status}.`,
    retryable: response.status === 429 || response.status >= 500,
    statusCode: response.status,
  });
}
