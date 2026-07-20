import {
  describe,
  expect,
  it,
} from "vitest";

import {
  Identifier,
} from "../../kernel";
import {
  Observation,
} from "./observation";
import {
  ObservationCollection,
  createSourceKey,
  createSubjectKey,
} from "./observation-collection";

function createObservation(
  input: {
    id: string;
    type: string;
    subjectType?: string;
    subjectId?: string;
    sourceType?: string;
    sourceName?: string;
    observedAt: string;
    recordedAt?: string;
    value?: number;
  },
) {
  return Observation.create({
    id: Identifier.create(input.id),
    type: input.type,
    subject: {
      type:
        input.subjectType ??
        "property",
      id:
        input.subjectId ??
        "property-001",
    },
    label: input.type,
    value: input.value ?? 1,
    source: {
      type:
        input.sourceType ??
        "provider",
      name:
        input.sourceName ??
        "RentCast",
    },
    observedAt:
      new Date(input.observedAt),
    recordedAt:
      new Date(
        input.recordedAt ??
        input.observedAt,
      ),
  });
}

const adr = createObservation({
  id: "observation-adr",
  type: "market-adr",
  observedAt:
    "2026-07-17T12:00:00.000Z",
  value: 184,
});

const occupancy = createObservation({
  id: "observation-occupancy",
  type: "market-occupancy",
  observedAt:
    "2026-07-18T12:00:00.000Z",
  value: 71,
});

const newerAdr = createObservation({
  id: "observation-adr-newer",
  type: "market-adr",
  subjectId: "property-002",
  sourceType: "internal-calculation",
  sourceName: "Market Intelligence",
  observedAt:
    "2026-07-19T12:00:00.000Z",
  recordedAt:
    "2026-07-19T12:05:00.000Z",
  value: 190,
});

describe("ObservationCollection", () => {
  it("creates an immutable snapshot", () => {
    const source = [adr];
    const collection =
      ObservationCollection.create(source);

    source.push(occupancy);

    expect(collection.size).toBe(1);
    expect(collection.toArray()).toEqual([
      adr,
    ]);
  });

  it("supports empty collections", () => {
    const collection =
      ObservationCollection.empty();

    expect(collection.size).toBe(0);
    expect(collection.isEmpty).toBe(true);
    expect(collection.isNotEmpty).toBe(
      false,
    );
  });

  it("rejects duplicate observation ids", () => {
    const duplicate =
      createObservation({
        id: "observation-adr",
        type: "different-type",
        observedAt:
          "2026-07-20T12:00:00.000Z",
      });

    expect(() =>
      ObservationCollection.create([
        adr,
        duplicate,
      ]),
    ).toThrow(
      "Observation collection cannot contain duplicate observation ids.",
    );
  });

  it("gets, requires, and checks identity", () => {
    const collection =
      ObservationCollection.create([
        adr,
        occupancy,
      ]);

    expect(collection.has(adr.id)).toBe(
      true,
    );
    expect(collection.get(adr.id)).toBe(
      adr,
    );
    expect(collection.require(adr.id)).toBe(
      adr,
    );
    expect(() =>
      collection.require(
        Identifier.create("missing"),
      ),
    ).toThrow(
      "Observation collection does not contain the requested observation.",
    );
  });

  it("adds and removes without mutating", () => {
    const original =
      ObservationCollection.create([adr]);
    const added =
      original.add(occupancy);
    const removed =
      added.remove(adr.id);

    expect(original.size).toBe(1);
    expect(added.size).toBe(2);
    expect(removed.toArray()).toEqual([
      occupancy,
    ]);
  });

  it("filters by type and subject", () => {
    const collection =
      ObservationCollection.create([
        adr,
        occupancy,
        newerAdr,
      ]);

    expect(
      collection
        .ofType("market-adr")
        .toArray(),
    ).toEqual([adr, newerAdr]);

    expect(
      collection
        .concerning(
          "property",
          "property-001",
        )
        .toArray(),
    ).toEqual([adr, occupancy]);
  });

  it("filters by source", () => {
    const collection =
      ObservationCollection.create([
        adr,
        occupancy,
        newerAdr,
      ]);

    expect(
      collection
        .fromSource("provider")
        .toArray(),
    ).toEqual([adr, occupancy]);

    expect(
      collection
        .fromSource(
          "internal-calculation",
          "Market Intelligence",
        )
        .toArray(),
    ).toEqual([newerAdr]);
  });

  it("filters inclusive observation ranges", () => {
    const collection =
      ObservationCollection.create([
        adr,
        occupancy,
        newerAdr,
      ]);

    const filtered =
      collection.observedBetween(
        new Date(
          "2026-07-18T12:00:00.000Z",
        ),
        new Date(
          "2026-07-19T12:00:00.000Z",
        ),
      );

    expect(filtered.toArray()).toEqual([
      occupancy,
      newerAdr,
    ]);
  });

  it("rejects inverted time ranges", () => {
    const collection =
      ObservationCollection.create([adr]);

    expect(() =>
      collection.observedBetween(
        new Date(
          "2026-07-20T00:00:00.000Z",
        ),
        new Date(
          "2026-07-19T00:00:00.000Z",
        ),
      ),
    ).toThrow(
      "Observation range start cannot be after range end.",
    );
  });

  it("sorts chronologically and finds extrema", () => {
    const collection =
      ObservationCollection.create([
        occupancy,
        newerAdr,
        adr,
      ]);

    expect(
      collection
        .oldestObservedFirst()
        .toArray(),
    ).toEqual([adr, occupancy, newerAdr]);

    expect(
      collection
        .newestObservedFirst()
        .toArray(),
    ).toEqual([newerAdr, occupancy, adr]);

    expect(
      collection.latestObserved(),
    ).toBe(newerAdr);

    expect(
      collection.earliestObserved(),
    ).toBe(adr);

    expect(
      collection.latestOfType(
        "market-adr",
      ),
    ).toBe(newerAdr);
  });

  it("groups by type", () => {
    const groups =
      ObservationCollection.create([
        adr,
        occupancy,
        newerAdr,
      ]).groupByType();

    expect(
      groups
        .get("market-adr")
        ?.toArray(),
    ).toEqual([adr, newerAdr]);

    expect(
      groups
        .get("market-occupancy")
        ?.toArray(),
    ).toEqual([occupancy]);
  });

  it("groups by stable subject and source keys", () => {
    const collection =
      ObservationCollection.create([
        adr,
        occupancy,
        newerAdr,
      ]);

    const subjectGroups =
      collection.groupBySubject();
    const sourceGroups =
      collection.groupBySource();

    expect(
      subjectGroups
        .get(
          createSubjectKey(
            "property",
            "property-001",
          ),
        )
        ?.toArray(),
    ).toEqual([adr, occupancy]);

    expect(
      sourceGroups
        .get(
          createSourceKey(
            "provider",
            "RentCast",
          ),
        )
        ?.toArray(),
    ).toEqual([adr, occupancy]);
  });

  it("is iterable", () => {
    const collection =
      ObservationCollection.create([
        adr,
        occupancy,
      ]);

    expect([...collection]).toEqual([
      adr,
      occupancy,
    ]);
  });
  it("filters observations by provenance and retrieval time", () => {
    const withProvenance =
      Observation.create({
        id: Identifier.create(
          "observation-with-provenance",
        ),
        type: "market-adr",
        subject: {
          type: "property",
          id: "property-001",
        },
        label: "Market ADR",
        value: 184,
        source: {
          type: "provider",
          name: "RentCast",
        },
        observedAt: new Date(
          "2026-07-19T12:00:00.000Z",
        ),
        recordedAt: new Date(
          "2026-07-19T12:05:00.000Z",
        ),
        provenance: {
          retrievedAt: new Date(
            "2026-07-19T11:55:00.000Z",
          ),
          sourceObservationIds: [
            adr.id,
          ],
        },
      });

    const collection =
      ObservationCollection.create([
        adr,
        withProvenance,
      ]);

    expect(
      collection.withProvenance().toArray(),
    ).toEqual([withProvenance]);

    expect(
      collection.derived().toArray(),
    ).toEqual([withProvenance]);

    expect(
      collection
        .retrievedBetween(
          new Date(
            "2026-07-19T11:00:00.000Z",
          ),
          new Date(
            "2026-07-19T12:00:00.000Z",
          ),
        )
        .toArray(),
    ).toEqual([withProvenance]);
  });

});
