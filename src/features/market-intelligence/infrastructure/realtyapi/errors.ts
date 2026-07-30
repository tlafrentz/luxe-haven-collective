import { ProviderError, ProviderErrorCode } from "../../application/providers/provider-error";
import { ProviderType } from "../../domain/enums/provider-type";

export class RealtyApiError extends ProviderError {
  constructor(options: Omit<ConstructorParameters<typeof ProviderError>[0], "provider">) {
    super({ ...options, provider: ProviderType.RealtyApi });
    this.name = "RealtyApiError";
  }
}

export function normalizeRealtyApiError(error: unknown): RealtyApiError {
  if (error instanceof RealtyApiError) return error;
  if (error instanceof DOMException && error.name === "AbortError") {
    return new RealtyApiError({
      code: ProviderErrorCode.TimedOut,
      message: "RealtyAPI request timed out.",
      retryable: true,
      cause: error,
    });
  }
  return new RealtyApiError({
    code: ProviderErrorCode.Unknown,
    message: "An unexpected RealtyAPI provider error occurred.",
    cause: error,
  });
}
