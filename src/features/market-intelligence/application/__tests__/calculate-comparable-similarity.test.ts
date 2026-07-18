import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  PropertyComparable,
} from "../../domain/entities/property-comparable";

import {
  ComparableSubject,
} from "../../domain/entities/comparable-subject";

import {
  calculateComparableSimilarity,
} from "../calculate-comparable-similarity";

function createComparable(
  overrides: Partial<PropertyComparable> = {},
): PropertyComparable {

  return {
    id: "comp-1",
    address:
      "125 Main St",
    propertyType:
      "Single Family",
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1750,
    yearBuilt: 2000,
    distanceMiles: 0,
    ...overrides,
   } as unknown as
  PropertyComparable;
}

describe(
  "calculateComparableSimilarity",
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

    it(
      "returns 100 for an exact match",
      () => {
        const score =
          calculateComparableSimilarity({
            subject,
            comparable:
              createComparable(),
          });

        expect(score.value)
          .toBe(100);

        expect(score.isStrong)
          .toBe(true);
      },
    );

    it(
      "reduces the score across material differences",
      () => {
        const score =
          calculateComparableSimilarity({
            subject,
            comparable:
              createComparable({
                propertyType:
                  "Condo",
                bedrooms: 5,
                bathrooms: 4,
                squareFeet: 2625,
                yearBuilt: 2040,
                distanceMiles: 5,
              }),
          });

        expect(score.value)
          .toBe(6.67);

        expect(score.isWeak)
          .toBe(true);
      },
    );

    it(
      "uses neutral partial credit when data is missing",
      () => {
        const score =
          calculateComparableSimilarity({
            subject,
            comparable:
              createComparable({
                propertyType:
                  undefined,
                bedrooms:
                  undefined,
                bathrooms:
                  undefined,
                squareFeet:
                  undefined,
                yearBuilt:
                  undefined,
                distanceMiles:
                  undefined,
              }),
          });

        expect(score.value)
          .toBe(50);
      },
    );
  },
);
