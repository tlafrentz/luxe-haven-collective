import type {
  ProviderType,
} from "../../domain/enums/provider-type";

export enum ProviderErrorCode {
  InvalidRequest = "invalid-request",
  AuthenticationFailed = "authentication-failed",
  AccessDenied = "access-denied",
  NotFound = "not-found",
  RateLimited = "rate-limited",
  RequestFailed = "request-failed",
  InvalidResponse = "invalid-response",
  Unavailable = "unavailable",
  TimedOut = "timed-out",
  Unknown = "unknown",
}

export interface ProviderErrorOptions {
  readonly provider: ProviderType;
  readonly code: ProviderErrorCode;
  readonly message: string;
  readonly retryable?: boolean;
  readonly statusCode?: number;
  readonly cause?: unknown;
}

export class ProviderError extends Error {
  readonly provider: ProviderType;
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  readonly statusCode?: number;

  constructor(
    options: ProviderErrorOptions,
  ) {
    super(options.message, {
      cause: options.cause,
    });

    this.name = "ProviderError";
    this.provider = options.provider;
    this.code = options.code;
    this.retryable =
      options.retryable ?? false;
    this.statusCode = options.statusCode;
  }
}
