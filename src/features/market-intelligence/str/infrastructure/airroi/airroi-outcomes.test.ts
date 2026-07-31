import { describe, expect, it, vi } from "vitest";
import type { StrMarketQuery } from "../../domain";
import { AirRoiClient, type AirRoiTelemetry } from "./airroi-client";
import { getAirRoiConfig } from "./airroi-config";
import { AirRoiError } from "./airroi-errors";
import { AirRoiProvider } from "./airroi-provider";
import { classifyAirRoiMarketFailure } from "../investment-market-context-runtime";

const correlationId = "property-sync:test-correlation";
const query: StrMarketQuery = {
  subjectPropertyId: "subject-1",
  subjectPropertySnapshotId: "property-snapshot-1",
  location: { latitude: 30.27, longitude: -97.74 },
  property: { bedrooms: 3, bathrooms: 2, currency: "USD" },
  requestedAt: "2026-07-30T12:00:00.000Z",
  missingInputs: [],
};

function recorder() {
  const events: Array<{ event: string; attributes: Readonly<Record<string, unknown>> }> = [];
  const telemetry: AirRoiTelemetry = {
    emit(event, attributes) {
      events.push({ event, attributes });
    },
  };
  return { events, telemetry };
}

function client(
  fetchImplementation: typeof fetch,
  telemetry: AirRoiTelemetry,
  timeoutMs = 50,
) {
  return new AirRoiClient({
    apiKey: "never-log-this-key",
    baseUrl: "https://example.test",
    timeoutMs,
    maxRetries: 0,
    fetchImplementation,
    telemetry,
  });
}

function providerResult(events: ReturnType<typeof recorder>["events"]) {
  return events.find(({ event }) => event === "airroi_provider_result");
}

describe("AirROI sanitized provider outcomes", () => {
  it("records a successful response without request details or payloads", async () => {
    const recorded = recorder();
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      data: { revenue: 50_000, occupancy: 0.7 },
      private: "raw-provider-payload",
    })));

    await client(fetcher, recorded.telemetry).get(
      "revenue-estimate",
      "/calculator/estimate",
      { latitude: 30.27 },
      correlationId,
    );

    expect(providerResult(recorded.events)).toMatchObject({
      attributes: {
        correlationId,
        operation: "revenue-estimate",
        phase: "request",
        outcome: "success",
      },
    });
    expect(JSON.stringify(recorded.events)).not.toContain("never-log-this-key");
    expect(JSON.stringify(recorded.events)).not.toContain("30.27");
    expect(JSON.stringify(recorded.events)).not.toContain("raw-provider-payload");
  });

  it("enforces a timeout even when fetch never settles", async () => {
    const recorded = recorder();
    const never = new Promise<Response>(() => {});

    await expect(client(vi.fn(() => never), recorded.telemetry, 1).get(
      "comparables",
      "/listings/comparables",
      {},
      correlationId,
    )).rejects.toMatchObject({ code: "timed-out" });

    expect(providerResult(recorded.events)?.attributes).toMatchObject({
      outcome: "timeout",
      code: "timed-out",
    });
  });

  it("classifies a network failure", async () => {
    const recorded = recorder();
    await expect(client(
      vi.fn(async () => { throw new TypeError("socket closed"); }),
      recorded.telemetry,
    ).get("comparables", "/listings/comparables", {}, correlationId))
      .rejects.toMatchObject({ code: "unavailable" });
    expect(providerResult(recorded.events)?.attributes).toMatchObject({
      outcome: "network-failure",
      code: "unavailable",
    });
  });

  it("classifies a non-success HTTP response without reading its body", async () => {
    const recorded = recorder();
    await expect(client(
      vi.fn(async () => new Response("provider secret body", { status: 403 })),
      recorded.telemetry,
    ).get("comparables", "/listings/comparables", {}, correlationId))
      .rejects.toMatchObject({ code: "authentication", statusCode: 403 });
    expect(providerResult(recorded.events)?.attributes).toMatchObject({
      outcome: "http-error",
      code: "authentication",
      statusCode: 403,
    });
    expect(JSON.stringify(recorded.events)).not.toContain("provider secret body");
  });

  it("classifies malformed JSON", async () => {
    const recorded = recorder();
    await expect(client(
      vi.fn(async () => new Response("{not-json")),
      recorded.telemetry,
    ).get("comparables", "/listings/comparables", {}, correlationId))
      .rejects.toMatchObject({ code: "invalid-response" });
    expect(providerResult(recorded.events)?.attributes).toMatchObject({
      outcome: "malformed-response",
      code: "invalid-response",
    });
  });

  it("classifies a response mapping failure", async () => {
    const recorded = recorder();
    const malformedComparable = Object.defineProperty({}, "id", {
      get() {
        throw new Error("mapping exploded");
      },
    });
    const mockClient = {
      get: vi.fn(async (operation: string) => operation === "revenue-estimate"
        ? { data: { revenue: 50_000, occupancy: 0.7 } }
        : { data: [malformedComparable] }),
    } as unknown as AirRoiClient;
    const provider = new AirRoiProvider(
      mockClient,
      getAirRoiConfig({
        MARKET_INTELLIGENCE_ENABLED: "true",
        AIRROI_API_KEY: "configured",
      }),
      () => new Date("2026-07-30T12:00:00.000Z"),
      recorded.telemetry,
    );

    await expect(provider.retrieve(query, {
      snapshotId: "market-snapshot-1",
      correlationId,
    })).rejects.toMatchObject({ code: "mapping-failed" });

    expect(recorded.events.find(({ event }) => event === "airroi_provider_result")?.attributes)
      .toMatchObject({
        correlationId,
        phase: "mapping",
        outcome: "mapping-failure",
        code: "mapping-failed",
      });
  });
});

describe("AirROI workflow failure classifications", () => {
  it.each([
    ["timed-out", "STR_PROVIDER_UNAVAILABLE"],
    ["unavailable", "STR_PROVIDER_UNAVAILABLE"],
    ["authentication", "STR_PROVIDER_UNAVAILABLE"],
    ["rate-limited", "STR_PROVIDER_RATE_LIMITED"],
    ["invalid-request", "STR_REQUEST_REJECTED"],
    ["invalid-response", "STR_RESPONSE_INVALID"],
    ["mapping-failed", "STR_MAPPING_FAILED"],
  ] as const)("classifies %s as %s", (code, expected) => {
    expect(classifyAirRoiMarketFailure(new AirRoiError({
      code,
      message: "sanitized",
    }))).toBe(expected);
  });
});
