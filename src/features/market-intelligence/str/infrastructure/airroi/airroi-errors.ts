export type AirRoiErrorCode = "not-configured" | "authentication" | "invalid-request" | "not-found"
  | "unsupported-geography" | "rate-limited" | "timed-out" | "unavailable" | "invalid-response" | "unknown";

export class AirRoiError extends Error {
  readonly code: AirRoiErrorCode; readonly retryable: boolean; readonly statusCode?: number; readonly retryAfterSeconds?: number;
  constructor(input: { code: AirRoiErrorCode; message: string; retryable?: boolean; statusCode?: number; retryAfterSeconds?: number; cause?: unknown }) {
    super(input.message, { cause: input.cause }); this.name = "AirRoiError"; this.code = input.code;
    this.retryable = input.retryable ?? false; this.statusCode = input.statusCode; this.retryAfterSeconds = input.retryAfterSeconds;
  }
}

export function normalizeAirRoiError(error: unknown): AirRoiError {
  if (error instanceof AirRoiError) return error;
  if (error instanceof DOMException && error.name === "AbortError") return new AirRoiError({ code: "timed-out", message: "STR market provider request timed out.", retryable: true });
  return new AirRoiError({ code: "unknown", message: "STR market provider request failed.", cause: error });
}
