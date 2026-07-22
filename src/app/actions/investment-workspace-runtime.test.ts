import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProviderType } from "@/features/market-intelligence/domain/enums/provider-type";
import { ProviderError, ProviderErrorCode } from "@/features/market-intelligence/application/providers/provider-error";
import { providerFailure, providerSuccess } from "@/features/market-intelligence/application/providers/provider-result";
import {
  assertWorkspaceRateLimit, buildCachedMarketProviders, coalesceWorkspaceRequest, fingerprint,
  getInvestmentWorkspaceHealth, InvestmentWorkspaceRateLimitError, resetInvestmentWorkspaceRuntimeForTests,
  updateWorkspaceHealth,
} from "./investment-workspace-runtime";

beforeEach(() => resetInvestmentWorkspaceRuntimeForTests());

describe("investment workspace runtime controls", () => {
  it("limits submissions per actor without affecting another actor", () => {
    assertWorkspaceRateLimit("actor-a", 2, 1000); assertWorkspaceRateLimit("actor-a", 2, 1001);
    expect(() => assertWorkspaceRateLimit("actor-a", 2, 1002)).toThrow(InvestmentWorkspaceRateLimitError);
    expect(() => assertWorkspaceRateLimit("actor-b", 2, 1002)).not.toThrow();
  });

  it("expires rate windows deterministically", () => {
    assertWorkspaceRateLimit("actor", 1, 1000);
    expect(() => assertWorkspaceRateLimit("actor", 1, 61001)).not.toThrow();
  });

  it("coalesces identical in-flight operations", async () => {
    let resolve!: (value: string) => void;
    const operation = vi.fn(() => new Promise<string>((done) => { resolve = done; }));
    const first = coalesceWorkspaceRequest("same", operation);
    const second = coalesceWorkspaceRequest("same", operation);
    resolve("result");
    expect(await first).toBe("result"); expect(await second).toBe("result"); expect(operation).toHaveBeenCalledTimes(1);
  });

  it("does not coalesce distinct operations", async () => {
    const operation = vi.fn(async () => "result");
    await Promise.all([coalesceWorkspaceRequest("a", operation), coalesceWorkspaceRequest("b", operation)]);
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("uses deterministic redacted fingerprints", () => {
    const first = fingerprint({ address: "123 Main", analyses: ["sale", "rent"] });
    expect(first).toBe(fingerprint({ analyses: ["sale", "rent"], address: "123 Main" }));
    expect(first).not.toContain("123 Main");
  });

  it("caches successful property provider results immutably", async () => {
    const lookup = vi.fn(async () => providerSuccess({ provider: ProviderType.RentCast, candidates: [], retrievedAt: new Date() }));
    const acquire = vi.fn();
    const providers = buildCachedMarketProviders({ lookupPropertyCandidates: lookup }, { acquireComparables: acquire }, { ttlMs: 1000, retryCount: 0 });
    const request = { address: { streetAddress: "123 Main", city: "Mesa", state: "AZ", postalCode: "85201" } };
    const first = await providers.propertyProvider.lookupPropertyCandidates(request);
    expect(Object.isFrozen(first)).toBe(true);
    if (first.ok) expect(Object.isFrozen(first.data)).toBe(true);
    await providers.propertyProvider.lookupPropertyCandidates(request);
    expect(lookup).toHaveBeenCalledTimes(1); expect(getInvestmentWorkspaceHealth()).toMatchObject({ cacheHits: 1, cacheMisses: 1 });
  });

  it("invalidates resolution cache when the address changes", async () => {
    const lookup = vi.fn(async () => providerSuccess({ provider: ProviderType.RentCast, candidates: [] }));
    const providers = buildCachedMarketProviders({ lookupPropertyCandidates: lookup }, { acquireComparables: vi.fn() }, { ttlMs: 1000, retryCount: 0 });
    await providers.propertyProvider.lookupPropertyCandidates({ address: { streetAddress: "123 Main", city: "Mesa", state: "AZ", postalCode: "85201" } });
    await providers.propertyProvider.lookupPropertyCandidates({ address: { streetAddress: "124 Main", city: "Mesa", state: "AZ", postalCode: "85201" } });
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("reuses comparable evidence across unrelated Investment runs and invalidates Market criteria", async () => {
    const acquire = vi.fn(async (request) => providerSuccess({ provider: ProviderType.RentCast, purpose: request.purpose, candidates: [] }));
    const providers = buildCachedMarketProviders({ lookupPropertyCandidates: vi.fn() }, { acquireComparables: acquire }, { ttlMs: 1000, retryCount: 0 });
    const base = {
      subject: { id: "run-a-subject", providerReferences: [{ provider: ProviderType.RentCast, externalId: "provider-subject" }], address: { formatted: "123 Main" }, characteristics: { bedrooms: 3 }, coordinates: undefined },
      purpose: "sale-valuation" as const,
      criteria: { radiusMiles: 5, limit: 10, propertyTypes: [], bedroomRange: undefined, bathroomRange: undefined, squareFeetRange: undefined, occurredAfter: new Date("2026-01-01T00:00:00Z"), listingStatuses: [] },
    };
    await providers.comparableProvider.acquireComparables(base);
    await providers.comparableProvider.acquireComparables({ ...base, subject: { ...base.subject, id: "run-b-subject" }, criteria: { ...base.criteria, occurredAfter: new Date("2026-01-01T12:00:00Z") } });
    expect(acquire).toHaveBeenCalledTimes(1);
    await providers.comparableProvider.acquireComparables({ ...base, criteria: { ...base.criteria, radiusMiles: 10 } });
    expect(acquire).toHaveBeenCalledTimes(2);
  });

  it("expires provider cache entries", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
    const lookup = vi.fn(async () => providerSuccess({ provider: ProviderType.RentCast, candidates: [] }));
    const providers = buildCachedMarketProviders({ lookupPropertyCandidates: lookup }, { acquireComparables: vi.fn() }, { ttlMs: 1000, retryCount: 0 });
    const request = { address: { streetAddress: "123 Main", city: "Mesa", state: "AZ", postalCode: "85201" } };
    await providers.propertyProvider.lookupPropertyCandidates(request);
    clock.mockReturnValue(2001);
    await providers.propertyProvider.lookupPropertyCandidates(request);
    expect(lookup).toHaveBeenCalledTimes(2);
    clock.mockRestore();
  });

  it("retries transient failures but never caches failed results", async () => {
    const transient = new ProviderError({ provider: ProviderType.RentCast, code: ProviderErrorCode.Unavailable, message: "down", retryable: true });
    const lookup = vi.fn().mockResolvedValueOnce(providerFailure(transient)).mockResolvedValue(providerSuccess({ provider: ProviderType.RentCast, candidates: [] }));
    const providers = buildCachedMarketProviders({ lookupPropertyCandidates: lookup }, { acquireComparables: vi.fn() }, { ttlMs: 1000, retryCount: 1 });
    const request = { address: { streetAddress: "123 Main", city: "Mesa", state: "AZ", postalCode: "85201" } };
    expect((await providers.propertyProvider.lookupPropertyCandidates(request)).ok).toBe(true);
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("does not retry deterministic authentication failures", async () => {
    const failure = new ProviderError({ provider: ProviderType.RentCast, code: ProviderErrorCode.AuthenticationFailed, message: "no" });
    const lookup = vi.fn(async () => providerFailure(failure));
    const providers = buildCachedMarketProviders({ lookupPropertyCandidates: lookup }, { acquireComparables: vi.fn() }, { ttlMs: 1000, retryCount: 2 });
    await providers.propertyProvider.lookupPropertyCandidates({ address: { streetAddress: "123 Main", city: "Mesa", state: "AZ", postalCode: "85201" } });
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it("never caches failed provider results", async () => {
    const failure = new ProviderError({ provider: ProviderType.RentCast, code: ProviderErrorCode.InvalidResponse, message: "bad" });
    const lookup = vi.fn(async () => providerFailure(failure));
    const providers = buildCachedMarketProviders({ lookupPropertyCandidates: lookup }, { acquireComparables: vi.fn() }, { ttlMs: 1000, retryCount: 0 });
    const request = { address: { streetAddress: "123 Main", city: "Mesa", state: "AZ", postalCode: "85201" } };
    await providers.propertyProvider.lookupPropertyCandidates(request);
    await providers.propertyProvider.lookupPropertyCandidates(request);
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("records health without sensitive request data", () => {
    updateWorkspaceHealth({ success: false, durationMs: 123, errorCode: "MARKET_PROVIDER_UNAVAILABLE" });
    expect(getInvestmentWorkspaceHealth()).toMatchObject({ status: "degraded", lastDurationMs: 123, lastErrorCode: "MARKET_PROVIDER_UNAVAILABLE" });
  });
});
