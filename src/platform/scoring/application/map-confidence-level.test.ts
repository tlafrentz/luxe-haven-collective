import { describe, expect, it } from "vitest";

import { ConfidenceLevel } from "../domain/confidence-level";
import { ConfidenceScore } from "../domain/confidence-score";
import { mapConfidenceLevel } from "./map-confidence-level";

describe("mapConfidenceLevel", () => {
  it.each([
    [0, ConfidenceLevel.VERY_LOW],
    [19.999, ConfidenceLevel.VERY_LOW],
    [20, ConfidenceLevel.LOW],
    [39.999, ConfidenceLevel.LOW],
    [40, ConfidenceLevel.MODERATE],
    [59.999, ConfidenceLevel.MODERATE],
    [60, ConfidenceLevel.HIGH],
    [79.999, ConfidenceLevel.HIGH],
    [80, ConfidenceLevel.VERY_HIGH],
    [100, ConfidenceLevel.VERY_HIGH],
  ])("maps %s to %s", (value, expected) => {
    expect(
      mapConfidenceLevel(ConfidenceScore.create(value)),
    ).toBe(expected);
  });
});
