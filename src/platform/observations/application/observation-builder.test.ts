import {
  describe,
  expect,
  it,
} from "vitest";

import {
  Identifier,
} from "../../kernel";
import {
  ObservationBuilder,
} from "./observation-builder";

const observedAt = new Date(
  "2026-07-19T12:00:00.000Z",
);
const recordedAt = new Date(
  "2026-07-19T12:05:00.000Z",
);

function completeBuilder() {
  return ObservationBuilder.create()
    .withId(
      Identifier.create(
        "observation-001",
      ),
    )
    .withType("market-adr")
    .concerning({
      type: "market",
      id: "mesa-az",
    })
    .withLabel("Average daily rate")
    .withValue(184)
    .measuredIn({
      type: "currency-per-night",
      symbol: "USD",
    })
    .fromSource({
      type: "provider",
      name: "RentCast",
      referenceId: "record-123",
    })
    .observedAt(observedAt)
    .recordedAt(recordedAt);
}

describe("ObservationBuilder", () => {
  it("builds a complete observation", () => {
    const observation =
      completeBuilder().build();

    expect(observation.type).toBe(
      "market-adr",
    );
    expect(observation.value).toBe(184);
    expect(observation.subject.id).toBe(
      "mesa-az",
    );
    expect(observation.source.name).toBe(
      "RentCast",
    );
    expect(observation.unit?.symbol).toBe(
      "USD",
    );
  });

  it("preserves the value type", () => {
    const observation =
      ObservationBuilder.create()
        .withType("valuation-range")
        .concerning({
          type: "property",
          id: "property-001",
        })
        .withLabel("Valuation range")
        .withValue({
          low: 350000,
          estimated: 375000,
          high: 400000,
        } as const)
        .fromSource({
          type: "internal-calculation",
          name: "Market Intelligence",
        })
        .observedAt(observedAt)
        .recordedAt(recordedAt)
        .build();

    expect(
      observation.value.estimated,
    ).toBe(375000);
  });

  it("accepts null and false as explicit values", () => {
    const nullObservation =
      completeBuilder()
        .withValue(null)
        .build();

    const falseObservation =
      completeBuilder()
        .withValue(false)
        .build();

    expect(nullObservation.value).toBeNull();
    expect(falseObservation.value).toBe(
      false,
    );
  });

  it("reports missing fields", () => {
    const builder =
      ObservationBuilder.create()
        .withType("market-adr")
        .withValue(184);

    expect(builder.isComplete).toBe(false);
    expect(
      builder.getMissingFields(),
    ).toEqual([
      "subject",
      "label",
      "source",
      "observedAt",
      "recordedAt",
    ]);
  });

  it("rejects incomplete construction", () => {
    expect(() =>
      ObservationBuilder.create().build(),
    ).toThrow(
      "Observation builder is missing required fields: type, subject, label, value, source, observedAt, recordedAt.",
    );
  });

  it("does not mutate earlier builder stages", () => {
    const base =
      ObservationBuilder.create()
        .withType("market-adr");

    const completed =
      base
        .concerning({
          type: "market",
          id: "mesa-az",
        })
        .withLabel("Average daily rate")
        .withValue(184)
        .fromSource({
          type: "provider",
          name: "RentCast",
        })
        .observedAt(observedAt)
        .recordedAt(recordedAt);

    expect(base.isComplete).toBe(false);
    expect(completed.isComplete).toBe(
      true,
    );
  });

  it("clones an observation into a new builder", () => {
    const original =
      completeBuilder().build();

    const updated =
      ObservationBuilder.from(original)
        .withValue(192)
        .withLabel(
          "Updated average daily rate",
        )
        .build();

    expect(updated.id.equals(original.id)).toBe(
      true,
    );
    expect(updated.value).toBe(192);
    expect(updated.label).toBe(
      "Updated average daily rate",
    );
    expect(original.value).toBe(184);
  });

  it("can remove optional values", () => {
    const original =
      completeBuilder()
        .withMetadata({
          sampleSize: 12,
        })
        .build();

    const rebuilt =
      ObservationBuilder.from(original)
        .withoutUnit()
        .withoutMetadata()
        .build();

    expect(rebuilt.unit).toBeUndefined();
    expect(
      rebuilt.metadata,
    ).toBeUndefined();
  });

  it("copies dates supplied to the builder", () => {
    const mutableObservedAt =
      new Date(observedAt);

    const builder =
      completeBuilder().observedAt(
        mutableObservedAt,
      );

    mutableObservedAt.setUTCFullYear(2030);

    expect(
      builder.build()
        .observedAt
        .toISOString(),
    ).toBe(
      "2026-07-19T12:00:00.000Z",
    );
  });
  it("adds and removes provenance", () => {
    const withProvenance =
      completeBuilder()
        .withProvenance({
          retrievedAt: new Date(
            "2026-07-19T11:55:00.000Z",
          ),
          sampleSize: 8,
        })
        .build();

    const withoutProvenance =
      ObservationBuilder
        .from(withProvenance)
        .withoutProvenance()
        .build();

    expect(
      withProvenance.provenance
        ?.sampleSize,
    ).toBe(8);
    expect(
      withoutProvenance.provenance,
    ).toBeUndefined();
  });

});
