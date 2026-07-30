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
    const first = await lookupSubjectProperty({ address }, dependencies);
    const second = await lookupSubjectProperty({ address }, dependencies);
    expect(first).toBe(second);
    expect(first.id).toBe("subject-property-stable-id");
    expect(test.fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("refreshes into a new immutable version without changing canonical identity", async () => {
    const test = harness();
    let now = new Date("2026-07-29T12:00:00Z");
    const dependencies = { provider: test.provider, snapshots: test.snapshots, now: () => now, createId: () => "stable-id" };
    const first = await lookupSubjectProperty({ address }, dependencies);
    now = new Date("2026-07-30T12:00:00Z");
    const refreshed = await lookupSubjectProperty({ address, refresh: true }, dependencies);
    expect(refreshed.id).toBe(first.id);
    expect(refreshed.snapshotId).not.toBe(first.snapshotId);
    expect(refreshed.snapshotVersion).toBe(2);
    expect(first.snapshotVersion).toBe(1);
  });

  it("returns candidates rather than guessing when lookup is ambiguous", async () => {
    const test = harness({ suggestions: [suggestion, { property_id: "222", display_name: "650 S Main St Unit 2, Fort Worth, TX 76104" }] });
    try {
      await lookupSubjectProperty({ address }, { provider: test.provider, snapshots: test.snapshots });
      throw new Error("Expected ambiguity");
    } catch (error) {
      expect(error).toBeInstanceOf(AmbiguousSubjectPropertyError);
      expect((error as AmbiguousSubjectPropertyError).candidates).toHaveLength(2);
    }
    expect(test.fetchImplementation).toHaveBeenCalledOnce();
  });

  it("returns the normalized missing-property failure", async () => {
    const test = harness({ suggestions: [] });
    await expect(lookupSubjectProperty({ address }, { provider: test.provider, snapshots: test.snapshots }))
      .rejects.toEqual(new SubjectPropertyNotFoundError());
  });
});
