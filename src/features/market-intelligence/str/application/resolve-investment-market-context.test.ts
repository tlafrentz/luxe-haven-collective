import { describe, expect, it, vi } from "vitest";
import { InMemoryPropertySnapshotRepository } from "../../infrastructure/property-snapshot-repository";
import { mapRealtyApiProperty } from "../../infrastructure/realtyapi/mapper";
import type { PropertySnapshot } from "../../domain/subject-property";
import { InMemoryStrMarketSnapshotRepository } from "../infrastructure/str-market-snapshot-repository";
import { resolveInvestmentMarketContext } from "./resolve-investment-market-context";

const now = new Date("2026-07-30T12:00:00.000Z");
const address = "650 S Main St, Fort Worth, TX 76104";

function subject(snapshotId = "property-snapshot-1") {
  return mapRealtyApiProperty({ data: { home: {
    property_id: "realty-1",
    address: { formatted_address: address, line: "650 S Main St", city: "Fort Worth", state_code: "TX", postal_code: "76104" },
    location: { latitude: 32.72, longitude: -97.33 },
    description: { type: "single_family", beds: 3, baths: 2 },
  } } }, { providerPropertyId: "realty-1", formattedAddress: address }, {
    subjectPropertyId: "subject-1",
    snapshotId,
    snapshotVersion: 1,
    retrievedAt: now,
    requestedAddressKey: "650 s main st fort worth tx 76104",
  });
}

function propertySnapshot(property = subject()): PropertySnapshot {
  return {
    id: property.snapshotId,
    ownerId: "owner-1",
    workspaceId: "workspace-1",
    subjectPropertyId: property.id,
    normalizedAddressKey: "650 s main st fort worth tx 76104",
    version: 1,
    property,
    capturedAt: now,
    listingFreshUntil: new Date(now.getTime() + 86_400_000),
    expiresAt: new Date(now.getTime() + 7 * 86_400_000),
  };
}

const providerResult = {
  providerVersion: "airroi-api.v1",
  providerSnapshotReferences: ["request-1"],
  revenueEstimate: {
    projectedAdr: { amount: 210, currency: "USD" },
    projectedOccupancy: { value: 70 },
    projectedAnnualRevenue: { amount: 53_655, currency: "USD" },
    projectedRevPar: { amount: 147, currency: "USD" },
    currency: "USD",
    period: { basis: "provider-estimate" as const },
    confidence: { score: 80, level: "high" as const },
    evidenceIds: [],
    metricLineage: {},
  },
  comparables: [],
  evidence: [],
  warnings: [],
  appliedFilters: ["radiusMiles:3"],
};

const terminalEvents = [
  "market_snapshot_resolution_completed",
  "market_snapshot_resolution_limited",
  "market_snapshot_resolution_failed",
] as const;

function eventRecorder() {
  const events: Array<{ event: string; attributes: Readonly<Record<string, unknown>> }> = [];
  return {
    events,
    telemetry: {
      emit(event: string, attributes: Readonly<Record<string, unknown>>) {
        events.push({ event, attributes });
      },
    },
  };
}

function expectSingleTerminal(
  events: Array<{ event: string }>,
  expected: typeof terminalEvents[number],
) {
  expect(events.filter(({ event }) => terminalEvents.includes(event as typeof terminalEvents[number])))
    .toEqual([expect.objectContaining({ event: expected })]);
}

describe("resolveInvestmentMarketContext", () => {
  it("creates a canonical snapshot and then reuses it without provider calls", async () => {
    const properties = new InMemoryPropertySnapshotRepository();
    const markets = new InMemoryStrMarketSnapshotRepository();
    const property = subject();
    await properties.save(propertySnapshot(property));
    const propertyProvider = { search: vi.fn(), retrieve: vi.fn() };
    const marketProvider = { retrieve: vi.fn(async () => providerResult) };
    const dependencies = {
      propertyProvider,
      propertySnapshots: properties,
      marketProvider,
      marketSnapshots: markets,
      providerVersion: "airroi-api.v1",
      enabled: true,
    };
    const input = {
      ownerId: "owner-1",
      workspaceId: "workspace-1",
      address,
      property: { propertyType: "single_family", bedrooms: 3, bathrooms: 2 },
      correlationId: "correlation-1",
      requestedAt: now,
    };

    const live = await resolveInvestmentMarketContext(input, dependencies);
    const cached = await resolveInvestmentMarketContext(input, dependencies);

    expect(live.source).toBe("live-provider");
    expect(cached.source).toBe("persisted-snapshot");
    expect(live.marketSnapshot?.id).toBe(cached.marketSnapshot?.id);
    expect(propertyProvider.search).not.toHaveBeenCalled();
    expect(marketProvider.retrieve).toHaveBeenCalledOnce();
  });

  it("authorizes a supplied snapshot and performs no provider call", async () => {
    const properties = new InMemoryPropertySnapshotRepository();
    const markets = new InMemoryStrMarketSnapshotRepository();
    const property = subject();
    await properties.save(propertySnapshot(property));
    const live = await resolveInvestmentMarketContext({
      ownerId: "owner-1", workspaceId: "workspace-1", address,
      property: { propertyType: "single_family", bedrooms: 3, bathrooms: 2 },
      correlationId: "correlation-1", requestedAt: now,
    }, {
      propertyProvider: { search: vi.fn(), retrieve: vi.fn() },
      propertySnapshots: properties,
      marketProvider: { retrieve: vi.fn(async () => providerResult) },
      marketSnapshots: markets,
      providerVersion: "airroi-api.v1",
      enabled: true,
    });
    const retrieve = vi.fn();
    const recorded = eventRecorder();

    const supplied = await resolveInvestmentMarketContext({
      ownerId: "owner-1", workspaceId: "workspace-1", address,
      property: { propertyType: "single_family", bedrooms: 3, bathrooms: 2 },
      marketSnapshotId: live.marketSnapshot!.id,
      correlationId: "correlation-2", requestedAt: now,
    }, {
      propertySnapshots: properties,
      marketProvider: { retrieve },
      marketSnapshots: markets,
      providerVersion: "airroi-api.v1",
      enabled: true,
      telemetry: recorded.telemetry,
    });

    expect(supplied.source).toBe("persisted-snapshot");
    expect(retrieve).not.toHaveBeenCalled();
    expectSingleTerminal(recorded.events, "market_snapshot_resolution_completed");
  });

  it("keeps historical retrieval available while new retrieval is disabled", async () => {
    const property = subject();
    const properties = new InMemoryPropertySnapshotRepository();
    await properties.save(propertySnapshot(property));
    const recorded = eventRecorder();
    const result = await resolveInvestmentMarketContext({
      ownerId: "owner-1", workspaceId: "workspace-1", address, property: {},
      correlationId: "correlation-1", requestedAt: now,
    }, {
      propertyProvider: { search: vi.fn(), retrieve: vi.fn() },
      propertySnapshots: properties,
      marketSnapshots: new InMemoryStrMarketSnapshotRepository(),
      providerVersion: "airroi-api.v1",
      enabled: false,
      telemetry: recorded.telemetry,
    });
    expect(result).toMatchObject({
      source: "manual-fallback",
      subjectProperty: property,
      failureCode: "STR_PROVIDER_UNAVAILABLE",
    });
    expect(result.warnings[0]).toContain("not configured");
    expectSingleTerminal(recorded.events, "market_snapshot_resolution_limited");
  });

  it("preserves the canonical subject when STR retrieval fails", async () => {
    const property = subject();
    const properties = new InMemoryPropertySnapshotRepository();
    await properties.save(propertySnapshot(property));
    const events: Array<{ event: string; attributes: Readonly<Record<string, unknown>> }> = [];
    const result = await resolveInvestmentMarketContext({
      ownerId: "owner-1", workspaceId: "workspace-1", address, property: {},
      correlationId: "correlation-1", requestedAt: now,
    }, {
      propertyProvider: { search: vi.fn(), retrieve: vi.fn() },
      propertySnapshots: properties,
      marketProvider: { retrieve: vi.fn(async () => { throw new Error("temporary outage"); }) },
      marketSnapshots: new InMemoryStrMarketSnapshotRepository(),
      providerVersion: "airroi-api.v1",
      enabled: true,
      classifyMarketFailure: () => "STR_PROVIDER_UNAVAILABLE",
      telemetry: {
        emit(event, attributes) {
          events.push({ event, attributes });
        },
      },
    });
    expect(result).toMatchObject({
      source: "manual-fallback",
      subjectProperty: property,
      failureCode: "STR_PROVIDER_UNAVAILABLE",
    });
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        event: "coordinates_validation_completed",
        attributes: expect.objectContaining({
          latitudeAvailable: true,
          longitudeAvailable: true,
          coordinatesAvailable: true,
        }),
      }),
      expect.objectContaining({
        event: "airroi_adapter_activated",
      }),
      expect.objectContaining({
        event: "airroi_request_started",
      }),
      expect.objectContaining({
        event: "str_limitation_finalized",
        attributes: expect.objectContaining({
          limitationCode: "STR_PROVIDER_UNAVAILABLE",
        }),
      }),
    ]));
    expect(result.subjectPropertySnapshotId).toBe(property.snapshotId);
    expectSingleTerminal(events, "market_snapshot_resolution_limited");
    expect(events.find(({ event }) => event === "market_snapshot_resolution_limited")?.attributes)
      .toMatchObject({
        correlationId: "correlation-1",
        stage: "market-cache-and-provider-resolution",
        errorName: "Error",
        classification: "STR_PROVIDER_UNAVAILABLE",
      });
  });

  it("continues from successful canonical persistence into awaited STR resolution", async () => {
    const recorded = eventRecorder();
    const retrieve = vi.fn(async (
      _candidate: unknown,
      context: { snapshotId: string },
    ) => subject(context.snapshotId));
    const marketRetrieve = vi.fn(async () => providerResult);

    await resolveInvestmentMarketContext({
      ownerId: "owner-1", workspaceId: "workspace-1", address, property: {},
      correlationId: "correlation-handoff", requestedAt: now, forceRefresh: true,
    }, {
      propertyProvider: {
        search: vi.fn(async () => [{ providerPropertyId: "realty-1", formattedAddress: address }]),
        retrieve,
      },
      propertySnapshots: new InMemoryPropertySnapshotRepository(),
      marketProvider: { retrieve: marketRetrieve },
      marketSnapshots: new InMemoryStrMarketSnapshotRepository(),
      providerVersion: "airroi-api.v1",
      enabled: true,
      telemetry: recorded.telemetry,
    });

    const sequence = recorded.events.map(({ event }) => event);
    const required = [
      "subject_property_property_detail_mapping_completed",
      "subject_property_canonical_persistence_completed",
      "coordinates_validation_completed",
      "airroi_adapter_activated",
      "airroi_request_started",
      "market_snapshot_resolution_limited",
    ];
    expect(sequence.indexOf(required[0]!)).toBeGreaterThanOrEqual(0);
    for (let index = 1; index < required.length; index += 1) {
      expect(sequence.indexOf(required[index]!)).toBeGreaterThan(sequence.indexOf(required[index - 1]!));
    }
    expect(retrieve).toHaveBeenCalledOnce();
    expect(marketRetrieve).toHaveBeenCalledOnce();
    expect(recorded.events.find(({ event }) => event === "subject_property_canonical_persistence_completed")?.attributes)
      .toMatchObject({ snapshotVersion: 1 });
    expectSingleTerminal(recorded.events, "market_snapshot_resolution_limited");
  });

  it("emits one failed terminal event when subject loading throws", async () => {
    const recorded = eventRecorder();
    const expected = new Error("subject lookup unavailable");

    await expect(resolveInvestmentMarketContext({
      ownerId: "owner-1", workspaceId: "workspace-1", address, property: {},
      correlationId: "correlation-subject-failure", requestedAt: now,
    }, {
      propertyProvider: {
        search: vi.fn(async () => { throw expected; }),
        retrieve: vi.fn(),
      },
      propertySnapshots: new InMemoryPropertySnapshotRepository(),
      marketSnapshots: new InMemoryStrMarketSnapshotRepository(),
      providerVersion: "airroi-api.v1",
      enabled: true,
      telemetry: recorded.telemetry,
    })).rejects.toBe(expected);

    expectSingleTerminal(recorded.events, "market_snapshot_resolution_failed");
    expect(recorded.events.find(({ event }) => event === "market_snapshot_resolution_failed")?.attributes)
      .toMatchObject({
        correlationId: "correlation-subject-failure",
        stage: "subject-property-loading",
        errorName: "Error",
        classification: "SUBJECT_PROPERTY_RESOLUTION_FAILED",
      });
  });

  it("emits one failed terminal event when the property provider is absent", async () => {
    const recorded = eventRecorder();

    await expect(resolveInvestmentMarketContext({
      ownerId: "owner-1", workspaceId: "workspace-1", address, property: {},
      correlationId: "correlation-provider-missing", requestedAt: now,
    }, {
      propertySnapshots: new InMemoryPropertySnapshotRepository(),
      marketSnapshots: new InMemoryStrMarketSnapshotRepository(),
      providerVersion: "airroi-api.v1",
      enabled: true,
      telemetry: recorded.telemetry,
    })).rejects.toThrow("Canonical property intelligence is not configured");

    expectSingleTerminal(recorded.events, "market_snapshot_resolution_failed");
  });

  it("records comparable coverage and persistence without exposing provider payloads", async () => {
    const property = subject();
    const properties = new InMemoryPropertySnapshotRepository();
    await properties.save(propertySnapshot(property));
    const events: Array<{ event: string; attributes: Readonly<Record<string, unknown>> }> = [];

    const result = await resolveInvestmentMarketContext({
      ownerId: "owner-1", workspaceId: "workspace-1", address, property: {},
      correlationId: "property-sync:f85e8ceb-8cfe-43d9-929b-1e20d6578a7e",
      requestedAt: now,
    }, {
      propertyProvider: { search: vi.fn(), retrieve: vi.fn() },
      propertySnapshots: properties,
      marketProvider: { retrieve: vi.fn(async () => providerResult) },
      marketSnapshots: new InMemoryStrMarketSnapshotRepository(),
      providerVersion: "airroi-api.v1",
      enabled: true,
      telemetry: {
        emit(event, attributes) {
          events.push({ event, attributes });
        },
      },
    });

    expect(result).toMatchObject({
      subjectPropertySnapshotId: property.snapshotId,
      failureCode: "INSUFFICIENT_COMPARABLE_COVERAGE",
    });
    expect(events.map(({ event }) => event)).toEqual(expect.arrayContaining([
      "str_response_mapping_completed",
      "str_comparable_coverage_assessed",
      "str_market_snapshot_persistence_started",
      "str_market_snapshot_persistence_completed",
      "str_limitation_finalized",
    ]));
    expect(events.find(({ event }) => event === "str_comparable_coverage_assessed")?.attributes)
      .toMatchObject({
        comparableCount: 0,
        eligibleComparableCount: 0,
        minimumComparableCount: 5,
        sufficientCoverage: false,
      });
    expect(JSON.stringify(events)).not.toContain(address);
    expectSingleTerminal(events, "market_snapshot_resolution_limited");
  });
});
