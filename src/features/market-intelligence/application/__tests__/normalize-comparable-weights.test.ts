import {
  describe,
  expect,
  it,
} from "vitest";

import {
  SimilarityScore,
} from "../../domain/value-objects/similarity-score";

import {
  normalizeComparableWeights,
} from "../normalize-comparable-weights";

describe(
  "normalizeComparableWeights",
  () => {
    it(
      "normalizes scores to one",
      () => {
        const weights =
          normalizeComparableWeights({
            scores: [
              new SimilarityScore(
                90,
              ),
              new SimilarityScore(
                60,
              ),
              new SimilarityScore(
                50,
              ),
            ],
          });

        expect(
          weights.map(
            (weight) =>
              weight.value,
          ),
        ).toEqual([
          0.45,
          0.3,
          0.25,
        ]);

        expect(
          weights.reduce(
            (sum, weight) =>
              sum +
              weight.value,
            0,
          ),
        ).toBe(1);
      },
    );

    it(
      "excludes scores below the minimum",
      () => {
        const weights =
          normalizeComparableWeights({
            scores: [
              new SimilarityScore(
                80,
              ),
              new SimilarityScore(
                40,
              ),
            ],
            minimumSimilarity: 60,
          });

        expect(
          weights.map(
            (weight) =>
              weight.value,
          ),
        ).toEqual([
          1,
          0,
        ]);
      },
    );

    it(
      "falls back to equal weights when no scores qualify",
      () => {
        const weights =
          normalizeComparableWeights({
            scores: [
              new SimilarityScore(
                20,
              ),
              new SimilarityScore(
                30,
              ),
            ],
            minimumSimilarity: 70,
          });

        expect(
          weights.map(
            (weight) =>
              weight.value,
          ),
        ).toEqual([
          0.5,
          0.5,
        ]);
      },
    );
  },
);
