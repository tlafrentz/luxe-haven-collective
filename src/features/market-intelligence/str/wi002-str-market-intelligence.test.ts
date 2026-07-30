import { describe, expect, it, vi } from "vitest";
import { mapAirRoiRevenue, mapAirRoiComparables, mapAirRoiMarket } from "./infrastructure/airroi/airroi-response-mapper";
import { getAirRoiConfig, AirRoiConfigurationError } from "./infrastructure/airroi/airroi-config";
import { AirRoiClient } from "./infrastructure/airroi/airroi-client";
import { assessStrMarketConfidence, qualifyAndWeightComparables } from "./application/str-market-policy";
import { createStrMarketIntelligenceService } from "./application/get-str-market-intelligence";
import { mapMarketSnapshotToInvestmentAssumptions, selectStrAssumptions } from "./application/map-market-snapshot-to-investment-assumptions";
import { InMemoryStrMarketSnapshotRepository } from "./infrastructure/str-market-snapshot-repository";
import type { StrComparable, StrMarketQuery, StrProviderResult } from "./domain";

const context = { snapshotId: "snapshot-1", retrievedAt: "2026-07-29T00:00:00.000Z", requestId: "request-1" };
const query: StrMarketQuery = {
  subjectPropertyId: "subject-1", subjectPropertySnapshotId: "property-snapshot-1",
  location: { latitude: 30.27, longitude: -97.74 },
  property: { propertyType: "house", bedrooms: 3, bathrooms: 2, entirePlace: true, currency: "USD" },
  filters: { radiusMiles: 3, maximumComparableCount: 20, entirePlaceOnly: true }, requestedAt: context.retrievedAt,
  missingInputs: ["accommodates"],
};

function comparable(id: string, overrides: Partial<StrComparable> = {}): StrComparable {
  return {
    id, providerReference: { provider: "airroi", listingId: id }, location: { distanceMiles: 1 },
    property: { propertyType: "house", bedrooms: 3, bathrooms: 2, roomType: "Entire home", amenities: [] },
    performance: { adr: { amount: 200, currency: "USD" }, occupancy: { value: 70 }, activeDays: 180 },
    retrievedAt: context.retrievedAt, sourceOperation: "comparables", sourceSnapshotId: context.snapshotId, freshness: "fresh",
    missingFields: [], evidenceIds: [`e-${id}`], eligibility: "eligible", similarityScore: 0, evidenceQualityScore: 0, weight: 0, exclusionReasons: [],
    ...overrides,
  };
}

describe("WI-002 AirROI canonical mapping", () => {
  it("maps and deterministically derives revenue metrics with derivation lineage", () => {
    const result = mapAirRoiRevenue({ adr: 200, occupancy: 0.7, currency: "USD" }, context);
    expect(result.value.projectedOccupancy?.value).toBe(70);
    expect(result.value.projectedRevPar?.amount).toBe(140);
    expect(result.value.projectedAnnualRevenue?.amount).toBe(51_100);
    expect(result.value.metricLineage.annualRevenue?.derivation).toBe("luxe-haven-derived");
    expect(result.evidence.find((item) => item.rawMetricName === "annual_revenue")?.sourceEvidenceIds).toHaveLength(2);
  });

  it("rejects a revenue response without any valid metric", () => {
    expect(() => mapAirRoiRevenue({ adr: "bad", occupancy: 200 }, context)).toThrow("no valid metrics");
  });

  it("normalizes comparables without using provider ids as canonical ids", () => {
    const result = mapAirRoiComparables([{ id: "provider-7", adr: 220, occupancy: 72, amenities: ["Pool"] }], context);
    expect(result.values[0].id).not.toBe("provider-7");
    expect(result.values[0].providerReference.listingId).toBe("provider-7");
    expect(result.values[0].missingFields).toContain("active_days");
  });

  it("does not invent seasonality when monthly data is absent", () => {
    expect(mapAirRoiMarket({ adr: 190, occupancy: 65 }, context).seasonality).toBeUndefined();
  });

  it("qualifies, excludes, scores, and normalizes eligible weights", () => {
    const result = qualifyAndWeightComparables([
      comparable("good"), comparable("far", { location: { distanceMiles: 20 } }),
      comparable("room", { property: { propertyType: "house", bedrooms: 3, bathrooms: 2, roomType: "Private room", amenities: [] } }),
    ], query);
    expect(result.find((item) => item.id === "good")?.eligibility).toBe("eligible");
    expect(result.find((item) => item.id === "far")?.exclusionReasons).toContain("outside-maximum-radius");
    expect(result.reduce((sum, item) => sum + item.weight, 0)).toBeCloseTo(1);
  });

  it("reduces canonical confidence for sparse evidence, missing inputs, and relaxations", () => {
    const confidence = assessStrMarketConfidence({ query, comparables: [comparable("one")], hasRevenueEstimate: true,
      hasMarketMetrics: false, hasSeasonality: false, relaxedRules: ["radius expanded"] });
    expect(confidence.level).toBe("low");
    expect(confidence.limitations.join(" ")).toContain("Only 1 qualified");
  });
});

describe("WI-002 configuration and client policy", () => {
  it("materializes typed defaults and permits disabled manual mode", () => {
    const enabled = getAirRoiConfig({ MARKET_INTELLIGENCE_ENABLED: "true", AIRROI_API_KEY: "secret" });
    expect(enabled).toMatchObject({ timeoutMs: 15_000, maxRetries: 2, defaultRadiusMiles: 3, marketSnapshotTtlDays: 30 });
    expect(getAirRoiConfig({ MARKET_INTELLIGENCE_ENABLED: "false" }).apiKey).toBeUndefined();
  });
  it("fails safely without exposing a missing or malformed secret", () => {
    expect(() => getAirRoiConfig({ MARKET_INTELLIGENCE_ENABLED: "true" })).toThrow(AirRoiConfigurationError);
    expect(() => getAirRoiConfig({ MARKET_INTELLIGENCE_ENABLED: "true", AIRROI_API_KEY: "dont-print", AIRROI_BASE_URL: "bad" })).toThrow("configuration is invalid");
  });
  it("retries only transient statuses and never sends the key in the URL", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: { adr: 1 } }), { status: 200 }));
    const client = new AirRoiClient({ apiKey: "secret-key", baseUrl: "https://example.test", timeoutMs: 500, maxRetries: 2, fetchImplementation: fetcher });
    await client.get("test", "/v1/test", { latitude: 1 }, "correlation");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0][0])).not.toContain("secret-key");
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ "X-API-KEY": "secret-key" });
    expect(fetcher.mock.calls[0][1]?.headers).not.toHaveProperty("Authorization");
  });
});

describe("WI-002 snapshot lifecycle and investment activation", () => {
  it("reuses compatible snapshots, deduplicates concurrency, and refreshes immutably", async () => {
    const repository = new InMemoryStrMarketSnapshotRepository();
    const providerResult: StrProviderResult = {
      providerVersion: "airroi-api.v1", providerSnapshotReferences: ["request-1"],
      revenueEstimate: mapAirRoiRevenue({ adr: 200, occupancy: 70 }, context).value,
      comparables: Array.from({ length: 6 }, (_, index) => comparable(`c-${index}`)), evidence: [], warnings: [], appliedFilters: ["radiusMiles:3"],
    };
    const provider = { retrieve: vi.fn(async () => providerResult) };
    const service = createStrMarketIntelligenceService({ provider, repository, providerVersion: "airroi-api.v1", now: () => new Date(context.retrievedAt) });
    const input = { ownerId: "owner-1", workspaceId: "workspace-1", query };
    const [first, duplicate] = await Promise.all([service(input), service(input)]);
    expect(first.id).toBe(duplicate.id); expect(provider.retrieve).toHaveBeenCalledTimes(1);
    expect((await service(input)).id).toBe(first.id);
    const refreshed = await service({ ...input, refresh: true });
    expect(refreshed.id).not.toBe(first.id); expect(provider.retrieve).toHaveBeenCalledTimes(2);
    expect(await repository.findById(first.id, { ownerId: "owner-2", workspaceId: "workspace-1" })).toBeNull();
  });

  it("creates proposals and preserves snapshot lineage through overrides", () => {
    const estimate = mapAirRoiRevenue({ adr: 200, occupancy: 70 }, context).value;
    const snapshot = { id: "snapshot-1", revenueEstimate: estimate, confidence: { score: 80, level: "high", components: [], limitations: [] }, evidenceIds: [],
      seasonality: undefined } as unknown as Parameters<typeof mapMarketSnapshotToInvestmentAssumptions>[0];
    const proposal = mapMarketSnapshotToInvestmentAssumptions(snapshot, new Date(context.retrievedAt));
    const selected = selectStrAssumptions({ proposal, manual: { adr: 150, occupancyPercentage: 60 }, overrides: { adr: 225 } });
    expect(selected).toMatchObject({ adr: 225, occupancyPercentage: 70, source: "user-override", marketSnapshotId: "snapshot-1", overriddenFields: ["adr"] });
    expect(proposal.adr).toBe(200);
  });
});
