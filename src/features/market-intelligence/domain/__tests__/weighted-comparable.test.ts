import { describe, expect, it } from "vitest";
import type { ComparableProperty } from "../entities/comparable-property";
import { WeightedComparable } from "../entities/weighted-comparable";
import { ComparableAdjustment } from "../value-objects/comparable-adjustment";
import { ComparableWeight } from "../value-objects/comparable-weight";
import { SimilarityScore } from "../value-objects/similarity-score";

describe("WeightedComparable", () => {
  it("calculates adjustments and weighted value", () => {
    const comparable = new WeightedComparable({
      comparable: { id: "comp-1" } as unknown as ComparableProperty,
      similarityScore: new SimilarityScore(88),
      weight: new ComparableWeight(0.5),
      baseValue: 400000,
      adjustments: [
        new ComparableAdjustment({ type: "bedrooms", amount: 10000, reason: "Subject has one additional bedroom." }),
        new ComparableAdjustment({ type: "year-built", amount: -5000, reason: "Comparable is newer." }),
      ],
    });

    expect(comparable.totalAdjustment).toBe(5000);
    expect(comparable.adjustedValue).toBe(405000);
    expect(comparable.weightedValue).toBe(202500);
  });
});
