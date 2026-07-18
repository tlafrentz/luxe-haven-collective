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
  detectComparableOutliers,
} from "../detect-comparable-outliers";

function createComparable(
  id: string,
  value: number,
): WeightedComparable {
  return new WeightedComparable({
    comparable: {
      id,
    } as unknown as
      ComparableProperty,
    similarityScore:
      new SimilarityScore(
        80,
      ),
    weight:
      new ComparableWeight(
        1 / 3,
      ),
    baseValue: value,
  });
}

describe(
  "detectComparableOutliers",
  () => {
    it(
      "identifies values beyond the allowed median deviation",
      () => {
        const result =
          detectComparableOutliers({
            comparables: [
              createComparable(
                "comp-1",
                390000,
              ),
              createComparable(
                "comp-2",
                400000,
              ),
              createComparable(
                "outlier",
                800000,
              ),
            ],
            maximumDeviationRatio:
              0.35,
          });

        expect(
          result.excluded.map(
            (comparable) =>
              comparable
                .comparable
                .id,
          ),
        ).toEqual([
          "outlier",
        ]);

        expect(
          result.included,
        ).toHaveLength(2);
      },
    );

    it(
      "does not exclude values when fewer than three comparables exist",
      () => {
        const result =
          detectComparableOutliers({
            comparables: [
              createComparable(
                "comp-1",
                300000,
              ),
              createComparable(
                "comp-2",
                900000,
              ),
            ],
          });

        expect(
          result.excluded,
        ).toEqual([]);

        expect(
          result.included,
        ).toHaveLength(2);
      },
    );
  },
);
