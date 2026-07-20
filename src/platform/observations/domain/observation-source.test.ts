import { describe, expect, it } from "vitest";

import { ObservationSource } from "./observation-source";

describe("ObservationSource", () => {
  it("creates a traceable provider source", () => {
    const source = ObservationSource.create({
      type: "provider",
      name: "RentCast",
      referenceId: "record-123",
      version: "v1",
    });

    expect(source.type).toBe("provider");
    expect(source.name).toBe("RentCast");
    expect(source.referenceId).toBe("record-123");
    expect(source.version).toBe("v1");
    expect(source.isTraceable).toBe(true);
  });

  it("supports a source without a reference", () => {
    const source = ObservationSource.create({
      type: "internal-calculation",
      name: "Investment Intelligence",
    });

    expect(source.isTraceable).toBe(false);
  });

  it("rejects empty optional values", () => {
    expect(() =>
      ObservationSource.create({
        type: "provider",
        name: "RentCast",
        referenceId: " ",
      }),
    ).toThrow(
      "Observation source reference id cannot be empty.",
    );
  });
});
