import type {
  ComparableProperty,
} from "../domain/entities/comparable-property";

import type {
  ComparableSubject,
} from "../domain/entities/comparable-subject";

import {
  WeightedComparable,
} from "../domain/entities/weighted-comparable";

import {
  calculateComparableSimilarity,
} from "./calculate-comparable-similarity";

import type {
  ComparableSimilarityConfig,
} from "./comparable-similarity-config";

import {
  normalizeComparableWeights,
} from "./normalize-comparable-weights";

export interface BuildWeightedComparablesInput {
  readonly subject:
    ComparableSubject;

  readonly comparables:
    readonly ComparableProperty[];

  readonly config?:
    ComparableSimilarityConfig;

  readonly minimumSimilarity?:
    number;

  readonly resolveBaseValue?:
    (
      comparable:
        ComparableProperty,
    ) =>
      number | undefined;
}

export function buildWeightedComparables(
  input:
    BuildWeightedComparablesInput,
): readonly WeightedComparable[] {
  if (
    input.comparables.length === 0
  ) {
    return [];
  }

  const scores =
    input.comparables.map(
      (comparable) =>
        calculateComparableSimilarity({
          subject:
            input.subject,
          comparable,
          config:
            input.config,
        }),
    );

  const weights =
    normalizeComparableWeights({
      scores,
      minimumSimilarity:
        input.minimumSimilarity,
    });

  return input.comparables.map(
    (comparable, index) =>
      new WeightedComparable({
        comparable,
        similarityScore:
          scores[index],
        weight:
          weights[index],
        baseValue:
          input.resolveBaseValue
            ?.(
              comparable,
            ) ??
          resolveComparableBaseValue(
            comparable,
          ),
      }),
  );
}

function resolveComparableBaseValue(
  comparable:
    ComparableProperty,
): number | undefined {
  if (
    comparable.estimatedValue !==
    undefined
  ) {
    return comparable
      .estimatedValue;
  }

  /**
   * Temporary migration bridge for older test fixtures and provider objects
   * that exposed a primitive `price` property.
   *
   * Remove after MI-6.4 moves all tests and providers to ComparableProperty.
   */
  const legacyPrice =
    (
      comparable as
        ComparableProperty & {
          readonly price?:
            number;
        }
    ).price;

  return (
    legacyPrice !== undefined &&
    Number.isFinite(
      legacyPrice,
    ) &&
    legacyPrice >= 0
  )
    ? legacyPrice
    : undefined;
}
