import { describe, expect, it } from "vitest";

import {
  calculateOverallConfidence,
  calculateProviderCoveragePercent,
  deriveConfidenceExplanations,
  weightedConfidenceAverage,
} from "../../builders/helpers/confidence-utils";

describe("confidence-utils", () => {
  const dimensions = [
    { name: "property", score: 90, weight: 0.25 },
    { name: "comparables", score: 70, weight: 0.75 },
  ] as const;

  it("calculates weighted confidence", () => {
    expect(weightedConfidenceAverage(dimensions)).toBe(75);
  });

  it("applies coverage, missing-data, and conflict penalties", () => {
    expect(
      calculateOverallConfidence({
        dimensions,
        providerCoveragePercent: 40,
        missingDataCount: 2,
        conflictingSignalCount: 2,
      }),
    ).toBeLessThan(75);
  });

  it("calculates provider coverage", () => {
    expect(calculateProviderCoveragePercent(3, 4)).toBe(75);
    expect(
      calculateProviderCoveragePercent(3, 0),
    ).toBeUndefined();
  });

  it("explains strongest and weakest dimensions", () => {
    const explanations = deriveConfidenceExplanations({
      dimensions,
      providerCoveragePercent: 75,
    });

    expect(explanations).toContain(
      "Property evidence is the strongest confidence dimension at 90.",
    );
    expect(explanations).toContain(
      "Comparables evidence is the weakest confidence dimension at 70.",
    );
  });
});
