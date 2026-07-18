import { describe, expect, it } from "vitest";
import type { ComparableProperty } from "../entities/comparable-property";
import { ComparableAnalysis } from "../entities/comparable-analysis";
import { ComparableSubject } from "../entities/comparable-subject";
import { WeightedComparable } from "../entities/weighted-comparable";
import { ComparableAdjustment } from "../value-objects/comparable-adjustment";
import { ComparableWeight } from "../value-objects/comparable-weight";
import { SimilarityScore } from "../value-objects/similarity-score";

function createComparable(id: string): ComparableProperty {
  return { id } as unknown as ComparableProperty;
}

describe("ComparableAnalysis", () => {
  it("calculates weighted estimated value", () => {
    const subject = new ComparableSubject({ address: "123 Main St, Mesa, AZ", bedrooms: 3, bathrooms: 2, squareFeet: 1750 });
    const first = new WeightedComparable({ comparable: createComparable("comp-1"), similarityScore: new SimilarityScore(90), weight: new ComparableWeight(0.6), baseValue: 400000, adjustments: [new ComparableAdjustment({ type: "square-feet", amount: 10000, reason: "Subject is larger." })] });
    const second = new WeightedComparable({ comparable: createComparable("comp-2"), similarityScore: new SimilarityScore(80), weight: new ComparableWeight(0.4), baseValue: 380000, adjustments: [new ComparableAdjustment({ type: "bathrooms", amount: -5000, reason: "Comparable has an additional bathroom." })] });
    const analysis = new ComparableAnalysis({ subject, comparables: [first, second] });
    expect(analysis.weightedEstimatedValue).toBe(396000);
    expect(analysis.totalWeight).toBe(1);
    expect(analysis.averageSimilarity).toBe(85);
  });

  it("requires at least one comparable", () => {
    expect(() => new ComparableAnalysis({ subject: new ComparableSubject({ address: "123 Main St" }), comparables: [] })).toThrow("Comparable analysis requires at least one comparable.");
  });
});
