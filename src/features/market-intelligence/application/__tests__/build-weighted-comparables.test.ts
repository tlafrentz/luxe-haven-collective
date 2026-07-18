import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ComparableProperty,
} from "../../domain/entities/comparable-property";

import {
  ComparableSubject,
} from "../../domain/entities/comparable-subject";

import {
  buildWeightedComparables,
} from "../build-weighted-comparables";

function createComparable(
  id: string,
  distanceMiles: number,
  price: number,
): ComparableProperty {
  return {
    id,
    address:
      `${id} Main St`,
    propertyType:
      "Single Family",
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1750,
    yearBuilt: 2000,
    distanceMiles,
    price,
  } as unknown as
    ComparableProperty;
}

describe(
  "buildWeightedComparables",
  () => {
    it(
      "builds scored and normalized comparables",
      () => {
        const subject =
          new ComparableSubject({
            address:
              "123 Main St",
            propertyType:
              "Single Family",
            bedrooms: 3,
            bathrooms: 2,
            squareFeet: 1750,
            yearBuilt: 2000,
          });

        const result =
          buildWeightedComparables({
            subject,
            comparables: [
              createComparable(
                "comp-1",
                0,
                400000,
              ),
              createComparable(
                "comp-2",
                5,
                380000,
              ),
            ],
          });

        expect(result)
          .toHaveLength(2);

        expect(
          result[0]
            .similarityScore
            .value,
        ).toBe(100);

        expect(
          result[1]
            .similarityScore
            .value,
        ).toBe(75);

        expect(
          result.reduce(
            (
              sum,
              comparable,
            ) =>
              sum +
              comparable
                .weight
                .value,
            0,
          ),
        ).toBe(1);

        expect(
          result[0]
            .baseValue,
        ).toBe(400000);
      },
    );

    it(
      "supports a custom base value resolver",
      () => {
        const subject =
          new ComparableSubject({
            address:
              "123 Main St",
          });

        const result =
          buildWeightedComparables({
            subject,
            comparables: [
              createComparable(
                "comp-1",
                1,
                400000,
              ),
            ],
            resolveBaseValue:
              () => 425000,
          });

        expect(
          result[0]
            .baseValue,
        ).toBe(425000);
      },
    );

    it(
      "returns an empty collection for no comparables",
      () => {
        const result =
          buildWeightedComparables({
            subject:
              new ComparableSubject({
                address:
                  "123 Main St",
              }),
            comparables: [],
          });

        expect(result)
          .toEqual([]);
      },
    );
  },
);
