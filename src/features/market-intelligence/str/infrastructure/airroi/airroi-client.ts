import type { AirRoiEnvelopeDto } from "./airroi-types";
import { AirRoiError, normalizeAirRoiError } from "./airroi-errors";

export interface AirRoiTelemetry {
  emit(event: string, attributes: Readonly<Record<string, string | number | boolean | undefined>>): void;
}
const noTelemetry: AirRoiTelemetry = { emit() {} };

export class AirRoiClient {
  private readonly baseUrl: string; private readonly apiKey: string; private readonly timeoutMs: number;
  private readonly maxRetries: number; private readonly fetcher: typeof fetch; private readonly telemetry: AirRoiTelemetry;
  constructor(options: { apiKey: string; baseUrl: string; timeoutMs: number; maxRetries: number; fetchImplementation?: typeof fetch; telemetry?: AirRoiTelemetry }) {
    if (!options.apiKey.trim()) throw new AirRoiError({ code: "not-configured", message: "STR market provider is not configured." });
    this.apiKey = options.apiKey; this.baseUrl = options.baseUrl.replace(/\/+$/, ""); this.timeoutMs = options.timeoutMs;
    this.maxRetries = options.maxRetries; this.fetcher = options.fetchImplementation ?? fetch; this.telemetry = options.telemetry ?? noTelemetry;
  }
  async get<T>(operation: string, path: string, parameters: Readonly<Record<string, string | number | boolean | undefined>>, correlationId: string): Promise<AirRoiEnvelopeDto<T>> {
    for (let attempt = 0; ; attempt += 1) {
      const started = Date.now(); this.telemetry.emit("airroi_request_started", { correlationId, operation, attempt });
      try {
        const value = await this.request<T>(path, parameters);
        this.telemetry.emit("airroi_request_succeeded", { correlationId, operation, attempt, durationMs: Date.now() - started });
        return value;
      } catch (error) {
        const normalized = normalizeAirRoiError(error);
        this.telemetry.emit("airroi_request_failed", { correlationId, operation, attempt, durationMs: Date.now() - started, code: normalized.code });
        if (!normalized.retryable || attempt >= this.maxRetries) throw normalized;
        this.telemetry.emit("airroi_request_retried", { correlationId, operation, attempt: attempt + 1 });
        await new Promise((resolve) => setTimeout(resolve, Math.min(2_000, 200 * 2 ** attempt) + Math.floor(Math.random() * 100)));
      }
    }
  }
  private async request<T>(path: string, parameters: Readonly<Record<string, string | number | boolean | undefined>>): Promise<AirRoiEnvelopeDto<T>> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(parameters)) if (value !== undefined) url.searchParams.set(key, String(value));
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(url, { headers: { Accept: "application/json", "X-API-KEY": this.apiKey }, signal: controller.signal });
      if (!response.ok) throw this.responseError(response);
      let parsed: unknown;
      try { parsed = await response.json(); } catch (cause) { throw new AirRoiError({ code: "invalid-response", message: "STR market provider returned invalid JSON.", cause }); }
      if (!parsed || typeof parsed !== "object") throw new AirRoiError({ code: "invalid-response", message: "STR market provider returned a malformed response." });
      const envelope = parsed as AirRoiEnvelopeDto<T>;
      return "data" in envelope ? envelope : { data: parsed as T, request_id: response.headers.get("x-request-id") ?? undefined };
    } catch (error) {
      if (error instanceof AirRoiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") throw new AirRoiError({ code: "timed-out", message: "STR market provider request timed out.", retryable: true });
      throw new AirRoiError({ code: "unavailable", message: "STR market provider is unavailable.", retryable: true, cause: error });
    } finally { clearTimeout(timeout); }
  }
  private responseError(response: Response): AirRoiError {
    const status = response.status;
    const code: AirRoiError["code"] = status === 401 || status === 403 ? "authentication" : status === 400 || status === 422 ? "invalid-request"
      : status === 404 ? "not-found" : status === 429 ? "rate-limited" : [502, 503, 504].includes(status) ? "unavailable" : "unknown";
    return new AirRoiError({ code, statusCode: status, retryable: status === 429 || [502, 503, 504].includes(status),
      retryAfterSeconds: Number(response.headers.get("retry-after")) || undefined, message: status === 401 || status === 403
        ? "STR market provider authentication failed." : `STR market provider request failed with HTTP ${status}.` });
  }
}
