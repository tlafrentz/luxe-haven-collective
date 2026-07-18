export interface ComparableSimilarityWeights {
  readonly distance: number;
  readonly squareFeet: number;
  readonly bedrooms: number;
  readonly bathrooms: number;
  readonly yearBuilt: number;
  readonly propertyType: number;
}

export interface ComparableSimilarityThresholds {
  readonly maximumDistanceMiles: number;
  readonly maximumSquareFeetVarianceRatio: number;
  readonly maximumBedroomDifference: number;
  readonly maximumBathroomDifference: number;
  readonly maximumYearBuiltDifference: number;
}

export interface ComparableSimilarityConfig {
  readonly weights:
    ComparableSimilarityWeights;
  readonly thresholds:
    ComparableSimilarityThresholds;
}

export const defaultComparableSimilarityConfig:
  ComparableSimilarityConfig = {
    weights: {
      distance: 25,
      squareFeet: 20,
      bedrooms: 20,
      bathrooms: 15,
      yearBuilt: 5,
      propertyType: 15,
    },
    thresholds: {
      maximumDistanceMiles: 5,
      maximumSquareFeetVarianceRatio: 0.5,
      maximumBedroomDifference: 3,
      maximumBathroomDifference: 2,
      maximumYearBuiltDifference: 40,
    },
  };

export function validateComparableSimilarityConfig(
  config:
    ComparableSimilarityConfig,
): void {
  const weightValues =
    Object.values(
      config.weights,
    );

  if (
    weightValues.some(
      (value) =>
        !Number.isFinite(value) ||
        value < 0,
    )
  ) {
    throw new Error(
      "Comparable similarity weights must be finite non-negative numbers.",
    );
  }

  const totalWeight =
    weightValues.reduce(
      (sum, value) =>
        sum + value,
      0,
    );

  if (
    Math.abs(
      totalWeight - 100,
    ) > 0.01
  ) {
    throw new Error(
      "Comparable similarity weights must total 100.",
    );
  }

  const thresholdValues =
    Object.values(
      config.thresholds,
    );

  if (
    thresholdValues.some(
      (value) =>
        !Number.isFinite(value) ||
        value <= 0,
    )
  ) {
    throw new Error(
      "Comparable similarity thresholds must be finite positive numbers.",
    );
  }
}
