import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ProviderError, ProviderErrorCode } from "../application/providers/provider-error";

export type MarketProviderClassification =
  | "SUCCESS"
  | "INVALID_REQUEST"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "SUBJECT_NOT_FOUND"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "PROVIDER_FAILURE"
  | "TRANSPORT_FAILURE"
  | "PROVIDER_SERIALIZATION"
  | "UNKNOWN";

export type MarketProviderOperationType =
  | "property-resolution"
  | "sale-estimate"
  | "rent-estimate";

export type SafeProviderRequestMetadata = Readonly<{
  addressHash?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  radius?: number;
  comparableCount?: number;
  acquisitionRoute: string;
}>;

export type ProviderAttemptContext = Readonly<{
  runId: string;
  operationId: string;
  operation: MarketProviderOperationType;
  provider: "rentcast";
  attempt: number;
  startedAt: string;
  startedMonotonicMs: number;
}>;

export type ProviderAttemptCompletion = Readonly<{
  result: "succeeded" | "failed";
  httpStatus?: number;
  providerErrorCode?: string;
  applicationErrorCode?: string;
  classification: MarketProviderClassification;
  retryable: boolean;
  payloadSize?: number;
  responseHash?: string;
}>;

export interface MarketProviderDiagnosticsObserver {
  start(input: Readonly<{
    operation: MarketProviderOperationType;
    requestMetadata: SafeProviderRequestMetadata;
    requestFingerprint: string;
  }>): Promise<ProviderAttemptContext>;
  complete(context: ProviderAttemptContext, completion: ProviderAttemptCompletion): Promise<void>;
}

export function classifyProviderFailure(input: Readonly<{
  status?: number;
  code?: ProviderErrorCode;
}>): MarketProviderClassification {
  if (input.code === ProviderErrorCode.InvalidResponse) return "PROVIDER_SERIALIZATION";
  if (input.code === ProviderErrorCode.TimedOut || input.status === 408) return "TIMEOUT";
  if (input.code === ProviderErrorCode.RequestFailed) return "TRANSPORT_FAILURE";
  if (input.code === ProviderErrorCode.InvalidRequest || input.status === 400) return "INVALID_REQUEST";
  if (input.code === ProviderErrorCode.AuthenticationFailed || input.status === 401) return "AUTHENTICATION";
  if (input.code === ProviderErrorCode.AccessDenied || input.status === 403) return "AUTHORIZATION";
  if (input.code === ProviderErrorCode.NotFound || input.status === 404) return "SUBJECT_NOT_FOUND";
  if (input.code === ProviderErrorCode.RateLimited || input.status === 429) return "RATE_LIMITED";
  if (input.code === ProviderErrorCode.Unavailable || (input.status !== undefined && input.status >= 500)) return "PROVIDER_FAILURE";
  return "UNKNOWN";
}

export function hashDiagnosticValue(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function fingerprintSafeProviderRequest(
  operation: MarketProviderOperationType,
  metadata: SafeProviderRequestMetadata,
): string {
  return hashDiagnosticValue(JSON.stringify({
    operation,
    ...Object.fromEntries(Object.entries(metadata).sort(([left], [right]) => left.localeCompare(right))),
  }));
}

export function safeRequestMetadataFromUrl(
  url: URL,
  acquisitionRoute: string,
): SafeProviderRequestMetadata {
  const number = (key: string) => {
    const value = url.searchParams.get(key);
    if (value === null) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const address = url.searchParams.get("address");
  return Object.freeze({
    ...(address ? { addressHash: hashDiagnosticValue(address) } : {}),
    ...(url.searchParams.get("propertyType") ? { propertyType: url.searchParams.get("propertyType")! } : {}),
    ...(number("bedrooms") !== undefined ? { bedrooms: number("bedrooms") } : {}),
    ...(number("bathrooms") !== undefined ? { bathrooms: number("bathrooms") } : {}),
    ...(number("squareFootage") !== undefined ? { squareFeet: number("squareFootage") } : {}),
    ...(number("maxRadius") !== undefined ? { radius: number("maxRadius") } : {}),
    ...(number("compCount") !== undefined ? { comparableCount: number("compCount") } : {}),
    acquisitionRoute,
  });
}

export function operationFromRentCastUrl(url: URL): MarketProviderOperationType {
  if (url.pathname.endsWith("/properties")) return "property-resolution";
  if (url.pathname.endsWith("/avm/rent/long-term")) return "rent-estimate";
  return "sale-estimate";
}

export type MarketAnalysisRunRecorder = Readonly<{
  event(stage: string, status: "started" | "completed" | "failed", metadata?: Readonly<Record<string, unknown>>): Promise<void>;
  setPropertyId(propertyId: string): Promise<void>;
  complete(result: "succeeded" | "failed", applicationErrorCode?: string): Promise<void>;
  observer: MarketProviderDiagnosticsObserver;
}>;

export async function startMarketAnalysisRun(input: Readonly<{
  runId: string;
  workspaceId: string;
  userId: string;
  acquisitionRoute: string;
  address: string;
  propertyType: string;
  startedAt: Date;
}>): Promise<MarketAnalysisRunRecorder> {
  let admin: ReturnType<typeof createAdminClient> | undefined;
  try {
    admin = createAdminClient();
  } catch {
    console.error(JSON.stringify({ event: "market_diagnostics_persistence_failed", runId: input.runId, reason: "configuration" }));
  }
  const startedMonotonicMs = Date.now();
  const attempts = new Map<MarketProviderOperationType, number>();
  const operationStarts = new Map<string, Promise<void>>();
  const persist = async (operation: () => PromiseLike<{ error: { message?: string } | null }>) => {
    if (!admin) return;
    try {
      const { error } = await operation();
      if (error) console.error(JSON.stringify({ event: "market_diagnostics_persistence_failed", runId: input.runId, reason: "storage" }));
    } catch {
      console.error(JSON.stringify({ event: "market_diagnostics_persistence_failed", runId: input.runId, reason: "unexpected" }));
    }
  };
  await persist(() => admin!.from("market_analysis_runs").insert({
    id: input.runId,
    workspace_id: input.workspaceId,
    user_id: input.userId,
    acquisition_route: input.acquisitionRoute,
    subject_address_hash: hashDiagnosticValue(input.address),
    subject_property_type: input.propertyType,
    started_at: input.startedAt.toISOString(),
    result: "running",
  }));
  const event = async (stage: string, status: "started" | "completed" | "failed", metadata: Readonly<Record<string, unknown>> = {}) => {
    const occurredAt = new Date().toISOString();
    console.info(JSON.stringify({ event: "market_analysis_stage", runId: input.runId, stage, status, timestamp: occurredAt, ...metadata }));
    await persist(() => admin!.from("market_provider_events").insert({
      id: `mi-event-${crypto.randomUUID()}`,
      run_id: input.runId,
      event_type: "analysis-stage",
      stage,
      status,
      safe_metadata: metadata,
      occurred_at: occurredAt,
    }));
  };
  const observer: MarketProviderDiagnosticsObserver = {
    async start(operationInput) {
      const attempt = (attempts.get(operationInput.operation) ?? 0) + 1;
      attempts.set(operationInput.operation, attempt);
      const context = Object.freeze({
        runId: input.runId,
        operationId: `mi-operation-${crypto.randomUUID()}`,
        operation: operationInput.operation,
        provider: "rentcast" as const,
        attempt,
        startedAt: new Date().toISOString(),
        startedMonotonicMs: Date.now(),
      });
      console.info(JSON.stringify({ event: "market_provider_request_started", runId: context.runId, operationId: context.operationId, provider: context.provider, operation: context.operation, attempt, timestamp: context.startedAt }));
      operationStarts.set(context.operationId, (async () => {
        await persist(() => admin!.from("market_provider_operations").insert({
          id: context.operationId,
          run_id: context.runId,
          attempt,
          provider: context.provider,
          operation_type: context.operation,
          started_at: context.startedAt,
          result: "running",
          request_fingerprint: operationInput.requestFingerprint,
          safe_request_metadata: operationInput.requestMetadata,
        }));
        await persist(() => admin!.from("market_provider_events").insert({
          id: `mi-event-${crypto.randomUUID()}`,
          run_id: context.runId,
          operation_id: context.operationId,
          event_type: "provider-request-started",
          stage: context.operation,
          status: "started",
          safe_metadata: { provider: context.provider, attempt },
          occurred_at: context.startedAt,
        }));
      })());
      return context;
    },
    async complete(context, completion) {
      const completedAt = new Date().toISOString();
      const durationMs = Math.max(0, Date.now() - context.startedMonotonicMs);
      await operationStarts.get(context.operationId);
      operationStarts.delete(context.operationId);
      console.info(JSON.stringify({
        event: "market_provider_request_completed",
        runId: context.runId,
        operationId: context.operationId,
        provider: context.provider,
        operation: context.operation,
        attempt: context.attempt,
        result: completion.result,
        status: completion.httpStatus,
        classification: completion.classification,
        retryable: completion.retryable,
        durationMs,
        timestamp: completedAt,
      }));
      await persist(() => admin!.from("market_provider_operations").update({
        completed_at: completedAt,
        duration_ms: durationMs,
        result: completion.result,
        http_status: completion.httpStatus ?? null,
        provider_error_code: completion.providerErrorCode ?? null,
        application_error_code: completion.applicationErrorCode ?? null,
        classification: completion.classification,
        retryable: completion.retryable,
        payload_size: completion.payloadSize ?? null,
        response_hash: completion.responseHash ?? null,
      }).eq("id", context.operationId));
      await persist(() => admin!.from("market_provider_events").insert({
        id: `mi-event-${crypto.randomUUID()}`,
        run_id: context.runId,
        operation_id: context.operationId,
        event_type: "provider-request-completed",
        stage: context.operation,
        status: completion.result === "succeeded" ? "completed" : "failed",
        safe_metadata: {
          provider: context.provider,
          attempt: context.attempt,
          httpStatus: completion.httpStatus,
          classification: completion.classification,
          retryable: completion.retryable,
          durationMs,
        },
        occurred_at: completedAt,
      }));
    },
  };
  return Object.freeze({
    observer,
    event,
    async setPropertyId(propertyId) {
      await persist(() => admin!.from("market_analysis_runs").update({
        property_id: propertyId,
      }).eq("id", input.runId));
      await event("property-resolution", "completed", { propertyId });
    },
    async complete(result, applicationErrorCode) {
      const completedAt = new Date().toISOString();
      const durationMs = Math.max(0, Date.now() - startedMonotonicMs);
      await persist(() => admin!.from("market_analysis_runs").update({
        completed_at: completedAt,
        duration_ms: durationMs,
        result,
        application_error_code: applicationErrorCode ?? null,
      }).eq("id", input.runId));
      await event("analysis", result === "succeeded" ? "completed" : "failed", { durationMs, applicationErrorCode });
    },
  });
}

export function providerErrorCompletion(error: unknown): ProviderAttemptCompletion {
  if (error instanceof ProviderError) {
    return Object.freeze({
      result: "failed",
      ...(error.statusCode !== undefined ? { httpStatus: error.statusCode } : {}),
      providerErrorCode: error.code,
      applicationErrorCode: error.code === ProviderErrorCode.RateLimited
        ? "MARKET_RATE_LIMITED"
        : "MARKET_PROVIDER_UNAVAILABLE",
      classification: classifyProviderFailure({ status: error.statusCode, code: error.code }),
      retryable: error.retryable,
    });
  }
  return Object.freeze({
    result: "failed",
    providerErrorCode: ProviderErrorCode.Unknown,
    applicationErrorCode: "MARKET_PROVIDER_UNAVAILABLE",
    classification: "UNKNOWN",
    retryable: false,
  });
}
