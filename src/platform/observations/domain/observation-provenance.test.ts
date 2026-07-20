import {
  describe,
  expect,
  it,
} from "vitest";

import {
  Identifier,
} from "../../kernel";
import type {
  ObservationId,
} from "./observation-id";
import {
  ObservationProvenance,
} from "./observation-provenance";

describe("ObservationProvenance", () => {
  it("creates provider retrieval provenance", () => {
    const provenance =
      ObservationProvenance.create({
        retrievedAt: new Date(
          "2026-07-19T12:00:00.000Z",
        ),
        effectiveAt: new Date(
          "2026-07-18T00:00:00.000Z",
        ),
        sampleSize: 14,
        notes: "Metro-level sample",
        version: "v2",
      });

    expect(
      provenance.retrievedAt.toISOString(),
    ).toBe("2026-07-19T12:00:00.000Z");
    expect(
      provenance.effectiveAt?.toISOString(),
    ).toBe("2026-07-18T00:00:00.000Z");
    expect(provenance.sampleSize).toBe(14);
    expect(provenance.hasSample).toBe(true);
    expect(provenance.version).toBe("v2");
  });

  it("tracks derived observation lineage", () => {
    const first: ObservationId =
      Identifier.create("observation-001");
    const second: ObservationId =
      Identifier.create("observation-002");

    const provenance =
      ObservationProvenance.create({
        retrievedAt: new Date(
          "2026-07-19T12:00:00.000Z",
        ),
        sourceObservationIds: [
          first,
          second,
        ],
      });

    expect(provenance.isDerived).toBe(true);
    expect(
      provenance.includesSourceObservation(
        second,
      ),
    ).toBe(true);
  });

  it("copies input dates and lineage arrays", () => {
    const retrievedAt = new Date(
      "2026-07-19T12:00:00.000Z",
    );
    const ids: ObservationId[] = [
      Identifier.create("observation-001"),
    ];

    const provenance =
      ObservationProvenance.create({
        retrievedAt,
        sourceObservationIds: ids,
      });

    retrievedAt.setUTCFullYear(2030);
    ids.push(
      Identifier.create("observation-002"),
    );

    expect(
      provenance.retrievedAt.toISOString(),
    ).toBe("2026-07-19T12:00:00.000Z");
    expect(
      provenance.sourceObservationIds,
    ).toHaveLength(1);
  });

  it("determines staleness against an explicit reference time", () => {
    const provenance =
      ObservationProvenance.create({
        retrievedAt: new Date(
          "2026-07-19T12:00:00.000Z",
        ),
      });

    expect(
      provenance.isOlderThan(
        60 * 60 * 1000,
        new Date(
          "2026-07-19T14:00:00.000Z",
        ),
      ),
    ).toBe(true);

    expect(
      provenance.isOlderThan(
        3 * 60 * 60 * 1000,
        new Date(
          "2026-07-19T14:00:00.000Z",
        ),
      ),
    ).toBe(false);
  });

  it("rejects invalid sample sizes", () => {
    expect(() =>
      ObservationProvenance.create({
        retrievedAt: new Date(),
        sampleSize: -1,
      }),
    ).toThrow(
      "Observation provenance sample size must be a non-negative integer.",
    );

    expect(() =>
      ObservationProvenance.create({
        retrievedAt: new Date(),
        sampleSize: 1.5,
      }),
    ).toThrow(
      "Observation provenance sample size must be a non-negative integer.",
    );
  });
});
