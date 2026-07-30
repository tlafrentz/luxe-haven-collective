import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { InMemoryPropertySnapshotRepository } from "../infrastructure/property-snapshot-repository";
import { RealtyApiClient } from "../infrastructure/realtyapi/client";
import { RealtyApiPropertyProvider } from "../infrastructure/realtyapi/provider";
import {
  AmbiguousSubjectPropertyError,
  SubjectPropertyNotFoundError,
  lookupSubjectProperty,
} from "./lookup-subject-property";

const address = "650 S Main St, Fort Worth, TX 76104";
const scope = { ownerId: "owner-1", workspaceId: "workspace-1" } as const;
const suggestion = { property_id: "987654321", display_name: address };
const details = {
  property_id: "987654321",
  address: { formatted_address: address, line: "650 S Main St", city: "Fort Worth", state_code: "TX", postal_code: "76104" },
  description: { type: "single_family", beds: 3, baths: 2, sqft: 1810 },
};

function harness(search: unknown = { suggestions: [suggestion] }) {
  const fetchImplementation = vi.fn(async (input: RequestInfo | URL) =>
    new Response(JSON.stringify(String(input).includes("/autocomplete") ? search : details), { status: 200 }));
  return {
    fetchImplementation,
    provider: new RealtyApiPropertyProvider(new RealtyApiClient({ apiKey: "key", fetchImplementation })),
    snapshots: new InMemoryPropertySnapshotRepository(),
  };
}

describe("lookupSubjectProperty", () => {
  it("performs a successful canonical lookup and serves a cache hit", async () => {
    const test = harness();
    const dependencies = { provider: test.provider, snapshots: test.snapshots, now: () => new Date("2026-07-29T12:00:00Z"), createId: () => "stable-id" };
    const first = await lookupSubjectProperty({ address, ...scope }, dependencies);
    const second = await lookupSubjectProperty({ address, ...scope }, dependencies);
    expect(first).toBe(second);
    expect(first.id).toBe("subject-property-stable-id");
    expect(test.fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("refreshes into a new immutable version without changing canonical identity", async () => {
    const test = harness();
    let now = new Date("2026-07-29T12:00:00Z");
    const dependencies = { provider: test.provider, snapshots: test.snapshots, now: () => now, createId: () => "stable-id" };
    const first = await lookupSubjectProperty({ address, ...scope }, dependencies);
    now = new Date("2026-07-30T12:00:00Z");
    const refreshed = await lookupSubjectProperty({ address, ...scope, refresh: true }, dependencies);
    expect(refreshed.id).toBe(first.id);
    expect(refreshed.snapshotId).not.toBe(first.snapshotId);
    expect(refreshed.snapshotVersion).toBe(2);
    expect(first.snapshotVersion).toBe(1);
  });

  it("returns candidates rather than guessing when lookup is ambiguous", async () => {
    const test = harness({ suggestions: [
      { property_id: "111", display_name: address },
      { property_id: "222", display_name: "650 South Main Street, Fort Worth, TX 76104" },
    ] });
    const diagnostics: Array<{
      stage: string;
      status: string;
      metadata?: Readonly<Record<string, number>>;
    }> = [];
    try {
      await lookupSubjectProperty({ address, ...scope }, {
        provider: test.provider,
        snapshots: test.snapshots,
        diagnostic(stage, status, metadata) {
          diagnostics.push({ stage, status, metadata });
        },
      });
      throw new Error("Expected ambiguity");
    } catch (error) {
      expect(error).toBeInstanceOf(AmbiguousSubjectPropertyError);
      expect(error).toMatchObject({ code: "PROPERTY_AMBIGUOUS" });
      expect((error as AmbiguousSubjectPropertyError).candidates).toHaveLength(2);
    }
    expect(test.fetchImplementation).toHaveBeenCalledOnce();
    expect(diagnostics).toContainEqual({
      stage: "candidate-selection",
      status: "completed",
      metadata: { candidateCount: 2, exactCandidateCount: 2 },
    });
  });

  it("selects, maps, and persists the live-envelope candidate in sequence", async () => {
    const autocomplete = JSON.parse(readFileSync(
      resolve(process.cwd(), "src/features/market-intelligence/infrastructure/realtyapi/fixtures/3108-bideker-ave.autocomplete.json"),
      "utf8",
    ));
    const detailsResponse = {
      detail: {
        property_id: "7039944051",
        status: "for_sale",
        list_price: 219000,
        details: { type: "single_family", beds: 4, baths: "2", sqft: 1320, year_built: 1935 },
        address: { line: "3108 Bideker Ave", city: "Fort Worth", state_code: "TX", postal_code: "76105", latitude: 32.718749, longitude: -97.280627 },
      },
    };
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL) =>
      new Response(JSON.stringify(String(input).includes("/autocomplete") ? autocomplete : detailsResponse), { status: 200 }));
    const snapshots = new InMemoryPropertySnapshotRepository();
    const diagnostics: Array<{
      stage: string;
      status: string;
      metadata?: Readonly<Record<string, number>>;
    }> = [];

    const property = await lookupSubjectProperty({
      address: "3108 Bideker Avenue, Fort Worth, TX 76105",
      ...scope,
    }, {
      provider: new RealtyApiPropertyProvider(new RealtyApiClient({ apiKey: "key", fetchImplementation })),
      snapshots,
      now: () => new Date("2026-07-30T12:00:00Z"),
      createId: () => "bideker",
      diagnostic(stage, status, metadata) { diagnostics.push({ stage, status, metadata }); },
    });

    expect(fetchImplementation.mock.calls.map(([input]) => String(input))).toEqual([
      expect.stringContaining("/autocomplete"),
      expect.stringContaining("property_id=7039944051"),
    ]);
    expect(property).toMatchObject({
      id: "subject-property-bideker",
      providerPropertyId: "7039944051",
      snapshotVersion: 1,
      address: { formatted: { value: "3108 Bideker Ave, Fort Worth, TX 76105" } },
    });
    await expect(snapshots.findById(property.snapshotId, scope)).resolves.toMatchObject({
      subjectPropertyId: property.id,
      normalizedAddressKey: "3108 bideker avenue fort worth tx 76105",
      property,
    });
    expect(diagnostics).toEqual([
      { stage: "autocomplete", status: "completed", metadata: { candidateCount: 4 } },
      {
        stage: "candidate-selection",
        status: "started",
        metadata: { candidateCount: 4, exactCandidateCount: 0 },
      },
      {
        stage: "candidate-selection",
        status: "completed",
        metadata: { candidateCount: 4, exactCandidateCount: 1 },
      },
      { stage: "property-detail-mapping", status: "completed", metadata: undefined },
      { stage: "canonical-persistence", status: "completed", metadata: { snapshotVersion: 1 } },
    ]);
  });

  it("returns the normalized missing-property failure", async () => {
    const test = harness({ suggestions: [] });
    await expect(lookupSubjectProperty({ address, ...scope }, { provider: test.provider, snapshots: test.snapshots }))
      .rejects.toEqual(new SubjectPropertyNotFoundError());
  });

  it("does not expose one owner's canonical subject to another owner", async () => {
    const test = harness();
    let sequence = 0;
    const dependencies = { provider: test.provider, snapshots: test.snapshots, createId: () => `stable-id-${++sequence}` };
    const ownerOne = await lookupSubjectProperty({ address, ...scope }, dependencies);
    const ownerTwo = await lookupSubjectProperty({
      address,
      ownerId: "owner-2",
      workspaceId: "workspace-1",
    }, dependencies);
    expect(ownerTwo.id).not.toBe(ownerOne.id);
    expect(test.fetchImplementation).toHaveBeenCalledTimes(4);
  });
});
