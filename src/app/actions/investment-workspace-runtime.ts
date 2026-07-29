import { createHash } from "node:crypto";

import type { MarketComparableProvider } from "@/features/market-intelligence/application/providers/market-comparable-provider";
import type { MarketPropertyResolutionProvider } from "@/features/market-intelligence/application/providers/market-property-resolution-provider";
import type { ProviderResult } from "@/features/market-intelligence/application/providers/provider-result";
import { ProviderErrorCode } from "@/features/market-intelligence/application/providers/provider-error";
import { providerSuccess } from "@/features/market-intelligence/application/providers/provider-result";
import { PropertyRecord } from "@/features/market-intelligence/domain/entities/property-record";
import { ProviderType } from "@/features/market-intelligence/domain/enums/provider-type";
import { ConfidenceScore } from "@/features/market-intelligence/domain/value-objects/confidence-score";
import { DataProvenance } from "@/features/market-intelligence/domain/value-objects/data-provenance";
import type { RunInvestmentWorkspaceAnalysisCommand } from "@/features/investment-intelligence";

type HealthStatus = "healthy" | "degraded" | "misconfigured" | "disabled" | "unknown";
type HealthSnapshot = Readonly<{
  status: HealthStatus;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastErrorCode?: string;
  lastDurationMs?: number;
  cacheHits: number;
  cacheMisses: number;
  rateLimitEvents: number;
}>;

type CacheEntry<T> = Readonly<{ expiresAt: number; value: T }>;
const resolutionCache = new Map<string, CacheEntry<Awaited<ReturnType<MarketPropertyResolutionProvider["lookupPropertyCandidates"]>>>>();
const comparableCache = new Map<string, CacheEntry<Awaited<ReturnType<MarketComparableProvider["acquireComparables"]>>>>();
const inFlight = new Map<string, Promise<unknown>>();
const actorWindows = new Map<string, number[]>();
let health: HealthSnapshot = { status: "unknown", cacheHits: 0, cacheMisses: 0, rateLimitEvents: 0 };

export class InvestmentWorkspaceRateLimitError extends Error {
  public constructor() { super("Investment workspace request limit reached."); this.name = "InvestmentWorkspaceRateLimitError"; }
}

export function assertWorkspaceRateLimit(actorId: string, maximum: number, now = Date.now()): void {
  const active = (actorWindows.get(actorId) ?? []).filter((value) => now - value < 60_000);
  if (active.length >= maximum) {
    health = { ...health, rateLimitEvents: health.rateLimitEvents + 1 };
    throw new InvestmentWorkspaceRateLimitError();
  }
  actorWindows.set(actorId, [...active, now]);
}

export async function coalesceWorkspaceRequest<T>(fingerprint: string, operation: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(fingerprint) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = operation().finally(() => inFlight.delete(fingerprint));
  inFlight.set(fingerprint, promise);
  return promise;
}

export function buildCachedMarketProviders(
  propertyProvider: MarketPropertyResolutionProvider,
  comparableProvider: MarketComparableProvider,
  options: Readonly<{ ttlMs: number; retryCount: number }>,
): Readonly<{ propertyProvider: MarketPropertyResolutionProvider; comparableProvider: MarketComparableProvider }> {
  return {
    propertyProvider: {
      lookupPropertyCandidates: (request) => cachedProviderCall(
        resolutionCache,
        fingerprint({ provider: "rentcast-property-v1", request }),
        options,
        () => propertyProvider.lookupPropertyCandidates(request),
      ),
    },
    comparableProvider: {
      acquireComparables: (request) => cachedProviderCall(
        comparableCache,
        fingerprint({ provider: "rentcast-comparables-v1", request: comparableCacheKey(request) }),
        options,
        () => comparableProvider.acquireComparables(request),
      ),
    },
  };
}

/**
 * Preserves a usable, explicitly low-confidence analysis when live Market
 * providers are unavailable. The subject facts come only from user-supplied
 * workspace inputs and the comparable set stays empty.
 */
export function buildSuppliedAssumptionMarketProviders(
  command: RunInvestmentWorkspaceAnalysisCommand,
): Readonly<{ propertyProvider: MarketPropertyResolutionProvider; comparableProvider: MarketComparableProvider }> {
  const address = command.address;
  const input = command.investmentInput;
  const formattedAddress = `${address.streetAddress.trim()}, ${address.city.trim()}, ${address.state.trim()} ${address.postalCode.trim()}`;
  const externalId = `manual:${fingerprint({ address, property: input.property }).slice(0, 24)}`;
  const property = new PropertyRecord(
    externalId,
    {
      formatted: formattedAddress,
      addressLine1: address.streetAddress.trim(),
      city: address.city.trim(),
      state: address.state.trim(),
      postalCode: address.postalCode.trim(),
      country: address.countryCode ?? "US",
    },
    {
      propertyType: input.property.propertyType,
      bedrooms: input.property.bedrooms,
      bathrooms: input.property.bathrooms,
      squareFeet: input.property.squareFeet,
    },
    input.acquisitionType === "purchase"
      ? {
          estimatedValue: input.property.purchasePrice,
          annualPropertyTaxes: input.operating.annualTaxes,
        }
      : {},
    new DataProvenance(
      ProviderType.Manual,
      command.context.requestedAt,
      new ConfidenceScore(25),
      1,
      "Subject facts supplied in the Investment workspace; live Market evidence unavailable.",
      "investment-workspace-fallback-v1",
    ),
  );

  return {
    propertyProvider: {
      lookupPropertyCandidates: async () => providerSuccess({
        provider: ProviderType.Manual,
        retrievedAt: command.context.requestedAt,
        candidates: [{ externalId, property }],
      }),
    },
    comparableProvider: {
      acquireComparables: async (request) => providerSuccess({
        provider: ProviderType.Manual,
        purpose: request.purpose,
        retrievedAt: command.context.requestedAt,
        candidates: [],
      }),
    },
  };
}

function comparableCacheKey(request: Parameters<MarketComparableProvider["acquireComparables"]>[0]): unknown {
  return {
    subject: {
      providerReferences: request.subject.providerReferences,
      address: request.subject.address,
      characteristics: request.subject.characteristics,
      coordinates: request.subject.coordinates,
    },
    purpose: request.purpose,
    criteria: {
      ...request.criteria,
      occurredAfter: request.criteria.occurredAfter.toISOString().slice(0, 10),
    },
  };
}

async function cachedProviderCall<T>(
  cache: Map<string, CacheEntry<ProviderResult<T>>>,
  key: string,
  options: Readonly<{ ttlMs: number; retryCount: number }>,
  operation: () => Promise<ProviderResult<T>>,
): Promise<ProviderResult<T>> {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    health = { ...health, cacheHits: health.cacheHits + 1 };
    return deepFreeze(structuredClone(cached.value));
  }
  cache.delete(key);
  health = { ...health, cacheMisses: health.cacheMisses + 1 };
  let result = await operation();
  for (let attempt = 0; !result.ok && attempt < options.retryCount && isTransient(result.error.code); attempt += 1) {
    result = await operation();
  }
  if (result.ok) {
    const immutable = deepFreeze(structuredClone(result));
    cache.set(key, { expiresAt: Date.now() + options.ttlMs, value: immutable });
    return deepFreeze(structuredClone(immutable));
  }
  return result;
}

function isTransient(code: ProviderErrorCode): boolean {
  return code === ProviderErrorCode.TimedOut || code === ProviderErrorCode.RequestFailed || code === ProviderErrorCode.Unavailable;
}

export function fingerprint(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function stable(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`).join(",")}}`;
  return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

export function recordWorkspaceOperation(event: "started" | "completed" | "failed", fields: Readonly<Record<string, string | number | boolean | undefined>>): void {
  const safe = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
  console.info(JSON.stringify({ event: `investment_workspace_run_${event}`, ...safe }));
}

export function updateWorkspaceHealth(update: Readonly<{ success: boolean; durationMs: number; errorCode?: string }>): void {
  health = update.success
    ? { ...health, status: "healthy", lastSuccessAt: new Date().toISOString(), lastDurationMs: update.durationMs, lastErrorCode: undefined }
    : { ...health, status: "degraded", lastFailureAt: new Date().toISOString(), lastDurationMs: update.durationMs, lastErrorCode: update.errorCode };
}

export function setWorkspaceHealthStatus(status: HealthStatus): void { health = { ...health, status }; }
export function getInvestmentWorkspaceHealth(): HealthSnapshot { return Object.freeze({ ...health }); }

export function resetInvestmentWorkspaceRuntimeForTests(): void {
  resolutionCache.clear(); comparableCache.clear(); inFlight.clear(); actorWindows.clear();
  health = { status: "unknown", cacheHits: 0, cacheMisses: 0, rateLimitEvents: 0 };
}
