import { describe, expect, it } from "vitest";

import { Identifier } from "../../kernel";
import { Observation } from "./observation";

const observedAt = new Date(
  "2026-07-19T12:00:00.000Z",
);
const recordedAt = new Date(
  "2026-07-19T12:05:00.000Z",
);

function createInput() {
  return {
    type: "market-adr",
    subject: {
      type: "market",
      id: "mesa-az",
    },
    label: "Average daily rate",
    value: 184,
    unit: {
      type: "currency-per-night",
      symbol: "USD",
    },
    source: {
      type: "provider",
      name: "RentCast",
      referenceId: "market-record-123",
    },
    observedAt,
    recordedAt,
  } as const;
}

describe("Observation", () => {
  it("creates a typed platform observation", () => {
    const observation = Observation.create(
      createInput(),
    );

    expect(observation.type).toBe("market-adr");
    expect(observation.label).toBe(
      "Average daily rate",
    );
    expect(observation.value).toBe(184);
    expect(observation.unit?.type).toBe(
      "currency-per-night",
    );
    expect(observation.unit?.symbol).toBe("USD");
    expect(observation.source.name).toBe(
      "RentCast",
    );
    expect(observation.concerns(
      "market",
      "mesa-az",
    )).toBe(true);
  });

  it("preserves observation identity", () => {
    const id = Identifier.create(
      "observation-001",
    );

    const first = Observation.create({
      ...createInput(),
      id,
      value: 184,
    });

    const second = Observation.create({
      ...createInput(),
      id,
      value: 200,
    });

    expect(first.equals(second)).toBe(true);
  });

  it("copies input dates", () => {
    const sourceObservedAt = new Date(observedAt);
    const sourceRecordedAt = new Date(recordedAt);

    const observation = Observation.create({
      ...createInput(),
      observedAt: sourceObservedAt,
      recordedAt: sourceRecordedAt,
    });

    sourceObservedAt.setUTCFullYear(2030);
    sourceRecordedAt.setUTCFullYear(2030);

    expect(
      observation.observedAt.toISOString(),
    ).toBe("2026-07-19T12:00:00.000Z");
    expect(
      observation.recordedAt.toISOString(),
    ).toBe("2026-07-19T12:05:00.000Z");
  });

  it("supports structured values and metadata", () => {
    const observation = Observation.create({
      ...createInput(),
      type: "valuation-range",
      value: {
        low: 350000,
        estimated: 375000,
        high: 400000,
      },
      metadata: {
        comparableIds: [
          "comparable-001",
          "comparable-002",
        ],
        sampleSize: 2,
      },
    });

    expect(observation.value).toEqual({
      low: 350000,
      estimated: 375000,
      high: 400000,
    });
    expect(observation.metadata).toEqual({
      comparableIds: [
        "comparable-001",
        "comparable-002",
      ],
      sampleSize: 2,
    });
  });

  it("checks observation types", () => {
    const observation = Observation.create(
      createInput(),
    );

    expect(
      observation.isType("market-adr"),
    ).toBe(true);
    expect(
      observation.isType("market-occupancy"),
    ).toBe(false);
  });

  it("rejects empty required text", () => {
    expect(() =>
      Observation.create({
        ...createInput(),
        type: " ",
      }),
    ).toThrow("Observation type cannot be empty.");

    expect(() =>
      Observation.create({
        ...createInput(),
        label: " ",
      }),
    ).toThrow("Observation label cannot be empty.");
  });

  it("rejects invalid timestamps", () => {
    expect(() =>
      Observation.create({
        ...createInput(),
        observedAt: new Date("invalid"),
      }),
    ).toThrow(
      "Observation observedAt must be valid.",
    );

    expect(() =>
      Observation.create({
        ...createInput(),
        recordedAt: new Date("invalid"),
      }),
    ).toThrow(
      "Observation recordedAt must be valid.",
    );
  });
  it("stores optional observation provenance", () => {
    const observation = Observation.create({
      ...createInput(),
      provenance: {
        retrievedAt: new Date(
          "2026-07-19T11:55:00.000Z",
        ),
        sampleSize: 12,
      },
    });

    expect(observation.hasProvenance).toBe(
      true,
    );
    expect(
      observation.provenance?.sampleSize,
    ).toBe(12);
  });

});
