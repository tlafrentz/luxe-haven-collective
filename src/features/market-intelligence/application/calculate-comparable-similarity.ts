import type {
  PropertyComparable,
} from "../domain/entities/property-comparable";

import type {
  ComparableSubject,
} from "../domain/entities/comparable-subject";

import {
  SimilarityScore,
} from "../domain/value-objects/similarity-score";

import {
  defaultComparableSimilarityConfig,
  validateComparableSimilarityConfig,
} from "./comparable-similarity-config";

import type {
  ComparableSimilarityConfig,
} from "./comparable-similarity-config";

export interface CalculateComparableSimilarityInput {
  readonly subject:
    ComparableSubject;
  readonly comparable: PropertyComparable;
  readonly config?:
    ComparableSimilarityConfig;
}

export function calculateComparableSimilarity(
  input:
    CalculateComparableSimilarityInput,
): SimilarityScore {
  const config =
    input.config ??
    defaultComparableSimilarityConfig;

  validateComparableSimilarityConfig(
    config,
  );

  const breakdown = {
    distance:
      scoreDistance(
        input.comparable
          .distanceMiles,
        config.thresholds
          .maximumDistanceMiles,
      ) *
      config.weights.distance,

    squareFeet:
      scoreSquareFeet(
        input.subject
          .squareFeet,
        input.comparable
          .squareFeet,
        config.thresholds
          .maximumSquareFeetVarianceRatio,
      ) *
      config.weights.squareFeet,

    bedrooms:
      scoreDifference(
        input.subject
          .bedrooms,
        input.comparable
          .bedrooms,
        config.thresholds
          .maximumBedroomDifference,
      ) *
      config.weights.bedrooms,

    bathrooms:
      scoreDifference(
        input.subject
          .bathrooms,
        input.comparable
          .bathrooms,
        config.thresholds
          .maximumBathroomDifference,
      ) *
      config.weights.bathrooms,

    yearBuilt:
      scoreDifference(
        input.subject
          .yearBuilt,
        input.comparable
          .yearBuilt,
        config.thresholds
          .maximumYearBuiltDifference,
      ) *
      config.weights.yearBuilt,

    propertyType:
      scorePropertyType(
        input.subject
          .propertyType,
        input.comparable
          .propertyType,
      ) *
      config.weights
        .propertyType,
  };

  const score =
    Object.values(
      breakdown,
    ).reduce(
      (sum, value) =>
        sum + value,
      0,
    );

  return new SimilarityScore(
    score,
    config.weights,
  );
}

function scoreDistance(
  distanceMiles:
    number | undefined,
  maximumDistanceMiles:
    number,
): number {
  if (
    distanceMiles === undefined ||
    !Number.isFinite(
      distanceMiles,
    ) ||
    distanceMiles < 0
  ) {
    return 0.5;
  }

  return linearScore(
    distanceMiles,
    maximumDistanceMiles,
  );
}

function scoreSquareFeet(
  subjectSquareFeet:
    number | undefined,
  comparableSquareFeet:
    number | undefined,
  maximumVarianceRatio:
    number,
): number {
  if (
    subjectSquareFeet === undefined ||
    comparableSquareFeet === undefined ||
    subjectSquareFeet <= 0 ||
    comparableSquareFeet <= 0
  ) {
    return 0.5;
  }

  const varianceRatio =
    Math.abs(
      comparableSquareFeet -
      subjectSquareFeet,
    ) /
    subjectSquareFeet;

  return linearScore(
    varianceRatio,
    maximumVarianceRatio,
  );
}

function scoreDifference(
  subjectValue:
    number | undefined,
  comparableValue:
    number | undefined,
  maximumDifference:
    number,
): number {
  if (
    subjectValue === undefined ||
    comparableValue === undefined
  ) {
    return 0.5;
  }

  return linearScore(
    Math.abs(
      comparableValue -
      subjectValue,
    ),
    maximumDifference,
  );
}

function scorePropertyType(
  subjectPropertyType:
    string | undefined,
  comparablePropertyType:
    string | undefined,
): number {
  const subject =
    normalizeText(
      subjectPropertyType,
    );

  const comparable =
    normalizeText(
      comparablePropertyType,
    );

  if (
    !subject ||
    !comparable
  ) {
    return 0.5;
  }

  return subject === comparable
    ? 1
    : 0;
}

function linearScore(
  difference: number,
  maximumDifference: number,
): number {
  if (
    difference <= 0
  ) {
    return 1;
  }

  if (
    difference >=
      maximumDifference
  ) {
    return 0;
  }

  return (
    1 -
    difference /
      maximumDifference
  );
}

function normalizeText(
  value: string | undefined,
): string | undefined {
  const normalized =
    value
      ?.trim()
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        " ",
      )
      .trim();

  return normalized ||
    undefined;
}
