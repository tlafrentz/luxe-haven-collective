import { describe, expect, it, vi } from "vitest";
import type {
  MarketProviderDiagnosticsObserver,
  ProviderAttemptCompletion,
  ProviderAttemptContext,
  SafeProviderRequestMetadata,
} from "../provider-diagnostics";
import { RentCastClient } from "./rentcast-client";
import { RentCastPropertyProvider } from "./rentcast-property-provider";
import { buildCachedMarketProviders } from "@/app/actions/investment-workspace-runtime";

type RecordedAttempt = {
  context: ProviderAttemptContext;
  metadata: SafeProviderRequestMetadata;
  requestFingerprint: string;
  completion?: ProviderAttemptCompletion;
};

function observer() {
  const attempts: RecordedAttempt[] = [];
  const value: MarketProviderDiagnosticsObserver = {
    async start(input) {
      const context = {
        runId: "MI-test-run",
        operationId: `operation-${attempts.length + 1}`,
        operation: input.operation,
        provider: "rentcast" as const,
        attempt: attempts.length + 1,
        startedAt: "2026-07-28T00:00:00.000Z",
        startedMonotonicMs: Date.now(),
      };
      attempts.push({ context, metadata: input.requestMetadata, requestFingerprint: input.requestFingerprint });
      return context;
    },
    async complete(context, completion) {
      const attempt = attempts.find(item => item.context.operationId === context.operationId)!;
      attempt.completion = completion;
    },
  };
  return { value, attempts };
}

function client(fetchImplementation: typeof fetch, diagnostics: MarketProviderDiagnosticsObserver) {
  return new RentCastClient({
    apiKey: "secret-that-must-not-be-recorded",
    fetchImplementation,
    diagnosticsObserver: diagnostics,
    acquisitionRoute: "rental-arbitrage",
  });
}

describe("MI-002 RentCast diagnostics integration", () => {
  it("records a successful request with correlation and safe response metadata", async () => {
    const diagnostics = observer();
    const fetchImplementation = vi.fn(async () => new Response("[]", { status: 200 })) as typeof fetch;
    await expect(client(fetchImplementation, diagnostics.value).searchProperties({ address: "123 Main St, Mesa, AZ 85201" })).resolves.toEqual([]);
    expect(diagnostics.attempts).toHaveLength(1);
    expect(diagnostics.attempts[0]).toMatchObject({
      context: { runId: "MI-test-run", operation: "property-resolution", attempt: 1 },
      completion: { result: "succeeded", httpStatus: 200, classification: "SUCCESS", payloadSize: 2 },
    });
    const recorded = JSON.stringify(diagnostics.attempts);
    expect(recorded).not.toContain("123 Main");
    expect(recorded).not.toContain("secret-that-must-not-be-recorded");
    expect(diagnostics.attempts[0]?.completion?.responseHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it.each([
    [401, "AUTHENTICATION"],
    [404, "SUBJECT_NOT_FOUND"],
    [429, "RATE_LIMITED"],
    [500, "PROVIDER_FAILURE"],
  ] as const)("records HTTP %s as %s", async (status, classification) => {
    const diagnostics = observer();
    const fetchImplementation = vi.fn(async () => new Response('{"safe":"error"}', { status })) as typeof fetch;
    await expect(client(fetchImplementation, diagnostics.value).searchProperties({ address: "123 Main St" })).rejects.toThrow();
    expect(diagnostics.attempts[0]?.completion).toMatchObject({
      result: "failed",
      httpStatus: status,
      classification,
    });
    expect(JSON.stringify(diagnostics.attempts)).not.toContain('{"safe":"error"}');
  });

  it("records timeout without inventing an HTTP status", async () => {
    const diagnostics = observer();
    const fetchImplementation = vi.fn(async () => {
      throw new DOMException("timed out", "AbortError");
    }) as typeof fetch;
    await expect(client(fetchImplementation, diagnostics.value).searchProperties({ address: "123 Main St" })).rejects.toThrow("timed out");
    expect(diagnostics.attempts[0]?.completion).toMatchObject({
      result: "failed",
      classification: "TIMEOUT",
      providerErrorCode: "timed-out",
      retryable: true,
    });
    expect(diagnostics.attempts[0]?.completion).not.toHaveProperty("httpStatus");
  });

  it("records invalid JSON as provider serialization", async () => {
    const diagnostics = observer();
    const fetchImplementation = vi.fn(async () => new Response("not-json", { status: 200 })) as typeof fetch;
    await expect(client(fetchImplementation, diagnostics.value).searchProperties({ address: "123 Main St" })).rejects.toThrow("invalid JSON");
    expect(diagnostics.attempts[0]?.completion).toMatchObject({
      httpStatus: 200,
      classification: "PROVIDER_SERIALIZATION",
      providerErrorCode: "invalid-response",
    });
  });

  it("records transport failure without raw error content", async () => {
    const diagnostics = observer();
    const fetchImplementation = vi.fn(async () => {
      throw new TypeError("socket included sensitive upstream detail");
    }) as typeof fetch;
    await expect(client(fetchImplementation, diagnostics.value).searchProperties({ address: "123 Main St" })).rejects.toThrow("request failed");
    expect(diagnostics.attempts[0]?.completion).toMatchObject({
      classification: "TRANSPORT_FAILURE",
      providerErrorCode: "request-failed",
      retryable: true,
    });
    expect(JSON.stringify(diagnostics.attempts)).not.toContain("sensitive upstream detail");
  });

  it("records every retry attempt without overwriting prior attempts", async () => {
    const diagnostics = observer();
    const fetchImplementation = vi.fn()
      .mockResolvedValueOnce(new Response('{"error":"temporary"}', { status: 500 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 })) as typeof fetch;
    const propertyProvider = new RentCastPropertyProvider({
      client: client(fetchImplementation, diagnostics.value),
    });
    const providers = buildCachedMarketProviders(
      propertyProvider,
      { acquireComparables: vi.fn() },
      { ttlMs: 30_000, retryCount: 1 },
    );
    const result = await providers.propertyProvider.lookupPropertyCandidates({
      address: { streetAddress: "123 Main St", city: "Mesa", state: "AZ", postalCode: "85201" },
    });
    expect(result.ok).toBe(true);
    expect(diagnostics.attempts).toHaveLength(2);
    expect(diagnostics.attempts.map(item => item.context.attempt)).toEqual([1, 2]);
    expect(diagnostics.attempts.map(item => item.completion?.classification)).toEqual([
      "PROVIDER_FAILURE",
      "SUCCESS",
    ]);
    expect(new Set(diagnostics.attempts.map(item => item.context.operationId)).size).toBe(2);
    expect(diagnostics.attempts.every(item => item.context.runId === "MI-test-run")).toBe(true);
  });
});
