import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ComparableProperty,
} from "../../domain/entities/comparable-property";

import {
  ComparableAnalysis,
} from "../../domain/entities/comparable-analysis";

import {
  ComparableSubject,
} from "../../domain/entities/comparable-subject";

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
  calculateMarketValuation,
} from "../calculate-market-valuation";

function createWeightedComparable(
  id: string,
  price: number,
  squareFeet: number,
  weight: number,
  similarity: number,
): WeightedComparable {
  return new WeightedComparable({
    comparable: {
      id,
      squareFeet,
    } as unknown as
      ComparableProperty,
    similarityScore:
      new SimilarityScore(
        similarity,
      ),
    weight:
      new ComparableWeight(
        weight,
      ),
    baseValue: price,
  });
}

describe(
  "calculateMarketValuation",
  () => {
    it(
      "calculates value range, PPSF, and confidence",
      () => {
        const analysis =
          new ComparableAnalysis({
            subject:
              new ComparableSubject({
                address:
                  "123 Main St",
                squareFeet: 2000,
              }),
            comparables: [
              createWeightedComparable(
                "comp-1",
                400000,
                2000,
                0.5,
                90,
              ),
              createWeightedComparable(
                "comp-2",
                420000,
                2100,
                0.3,
                85,
              ),
              createWeightedComparable(
                "comp-3",
                380000,
                1900,
                0.2,
                80,
              ),
            ],
          });

        const valuation =
          calculateMarketValuation({
            analysis,
          });

        expect(
          valuation
            .valueRange
            .estimated,
        ).toBe(402000);

        expect(
          valuation
            .valueRange
            .low,
        ).toBe(390000);

        expect(
          valuation
            .valueRange
            .high,
        ).toBe(410000);

        expect(
          valuation
            .averagePricePerSquareFoot,
        ).toBe(200);

        expect(
          valuation
            .medianPricePerSquareFoot,
        ).toBe(200);

        expect(
          valuation
            .weightedPricePerSquareFoot,
        ).toBe(201);

        expect(
          valuation
            .confidence
            .comparableCount,
        ).toBe(3);

        expect(
          valuation
            .excludedComparableIds,
        ).toEqual([]);
      },
    );

    it(
      "excludes material outliers",
      () => {
        const analysis =
          new ComparableAnalysis({
            subject:
              new ComparableSubject({
                address:
                  "123 Main St",
                squareFeet: 2000,
              }),
            comparables: [
              createWeightedComparable(
                "comp-1",
                400000,
                2000,
                0.4,
                90,
              ),
              createWeightedComparable(
                "comp-2",
                410000,
                2050,
                0.35,
                88,
              ),
              createWeightedComparable(
                "outlier",
                900000,
                2100,
                0.25,
                70,
              ),
            ],
          });

        const valuation =
          calculateMarketValuation({
            analysis,
            maximumOutlierDeviationRatio:
              0.35,
          });

        expect(
          valuation
            .excludedComparableIds,
        ).toEqual([
          "outlier",
        ]);

        expect(
          valuation
            .supportingComparables,
        ).toHaveLength(2);

        expect(
          valuation
            .valueRange
            .estimated,
        ).toBeCloseTo(
          404666.67,
          2,
        );
      },
    );

    it(
      "requires comparable values",
      () => {
        const analysis =
          new ComparableAnalysis({
            subject:
              new ComparableSubject({
                address:
                  "123 Main St",
              }),
            comparables: [
              new WeightedComparable({
                comparable: {
                  id: "comp-1",
                } as unknown as
                  ComparableProperty,
                similarityScore:
                  new SimilarityScore(
                    80,
                  ),
                weight:
                  new ComparableWeight(
                    1,
                  ),
              }),
            ],
          });

        expect(
          () =>
            calculateMarketValuation({
              analysis,
            }),
        ).toThrow(
          "Market valuation requires comparable values.",
        );
      },
    );
  },
);
