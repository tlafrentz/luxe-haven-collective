import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ComparableProperty,
} from "../../domain/entities/comparable-property";

import {
  WeightedComparable,
} from "../../domain/entities/weighted-comparable";

import {
  ComparableWeight,
} from "../../domain/value-objects/comparable-weight";

import {
  SimilarityScore,
} from "../../domain/value-objects/similarity-score";

import {
  calculateValuationConfidence,
} from "../calculate-valuation-confidence";

function createComparable(
  id: string,
  value: number,
  similarity: number,
): WeightedComparable {
  return new WeightedComparable({
    comparable: {
      id,
    } as unknown as
      ComparableProperty,
    similarityScore:
      new SimilarityScore(
        similarity,
      ),
    weight:
      new ComparableWeight(
        0.2,
      ),
    baseValue: value,
  });
}

describe(
  "calculateValuationConfidence",
  () => {
    it(
      "returns high confidence for a strong and consistent comparable set",
      () => {
        const confidence =
          calculateValuationConfidence({
            comparables: [
              createComparable(
                "comp-1",
                395000,
                90,
              ),
              createComparable(
                "comp-2",
                400000,
                88,
              ),
              createComparable(
                "comp-3",
                405000,
                86,
              ),
              createComparable(
                "comp-4",
                398000,
                89,
              ),
              createComparable(
                "comp-5",
                402000,
                87,
              ),
            ],
            estimatedValue:
              400000,
          });

        expect(
          confidence.level,
        ).toBe("high");

        expect(
          confidence.reasons,
        ).toEqual([]);
      },
    );

    it(
      "explains lower confidence",
      () => {
        const confidence =
          calculateValuationConfidence({
            comparables: [
              createComparable(
                "comp-1",
                300000,
                50,
              ),
              createComparable(
                "comp-2",
                500000,
                55,
              ),
            ],
            estimatedValue:
              400000,
          });

        expect(
          confidence.level,
        ).toBe("low");

        expect(
          confidence.reasons,
        ).toContain(
          "Fewer than three supporting comparables.",
        );

        expect(
          confidence.reasons,
        ).toContain(
          "Average comparable similarity is below 70.",
        );
      },
    );
  },
);
