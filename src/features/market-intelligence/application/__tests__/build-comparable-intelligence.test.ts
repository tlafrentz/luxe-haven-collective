import { describe, expect, it } from "vitest";

import {
  buildComparableIntelligence,
  type ComparableIntelligenceObservation,
} from "../builders/build-comparable-intelligence";
import type { PropertyComparable } from "../../domain/entities/property-comparable";

function comparable(id: string): PropertyComparable {
  return { id } as PropertyComparable;
}

describe("buildComparableIntelligence", () => {
  it("classifies and summarizes comparable evidence", () => {
    const observations: ComparableIntelligenceObservation[] = [
      {
        comparable: comparable("comp-1"),
        similarity: 90,
        quality: "strong",
        distanceMiles: 0.5,
        ageDifferenceYears: 2,
        sizeDifferencePercent: 5,
        estimatedValue: 440000,
      },
      {
        comparable: comparable("comp-2"),
        similarity: 84,
        quality: "strong",
        distanceMiles: 0.8,
        ageDifferenceYears: 4,
        sizeDifferencePercent: 8,
        estimatedValue: 455000,
      },
      {
        comparable: comparable("comp-3"),
        similarity: 72,
        quality: "moderate",
        distanceMiles: 1.2,
        ageDifferenceYears: 6,
        sizeDifferencePercent: 12,
        estimatedValue: 465000,
      },
      {
        comparable: comparable("comp-4"),
        similarity: 30,
        quality: "excluded",
        exclusionReason: "Property type mismatch.",
      },
    ];

    const intelligence = buildComparableIntelligence({
      observations,
      comparableScore: 82,
      confidenceScore: 86,
      weightedEstimatedValue: 452500,
      currency: "USD",
      topComparableLimit: 2,
    });

    expect(intelligence.totalComparableCount).toBe(4);
    expect(intelligence.includedComparableCount).toBe(3);
    expect(intelligence.strongMatchCount).toBe(2);
    expect(intelligence.hasSufficientComparableEvidence).toBe(true);
    expect(intelligence.topComparables).toHaveLength(2);
    expect(intelligence.medianComparableValue).toBe(455000);
    expect(intelligence.excludedComparables[0]?.reason).toBe(
      "Property type mismatch.",
    );
  });

  it("supports an empty comparable set", () => {
    const intelligence = buildComparableIntelligence({
      observations: [],
      comparableScore: 0,
      confidenceScore: 0,
    });

    expect(intelligence.totalComparableCount).toBe(0);
    expect(intelligence.averageSimilarity).toBe(0);
    expect(intelligence.hasSufficientComparableEvidence).toBe(false);
  });
});
