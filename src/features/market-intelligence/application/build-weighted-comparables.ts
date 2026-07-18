import type {
  PropertyComparable,
} from "../domain/entities/property-comparable";

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
    readonly PropertyComparable[];
  readonly config?:
    ComparableSimilarityConfig;
  readonly minimumSimilarity?: number;
  readonly resolveBaseValue?:
    (
      comparable:
        PropertyComparable,
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
          comparable
            .estimatedValue
            ?.amount,
      }),
  );
}
