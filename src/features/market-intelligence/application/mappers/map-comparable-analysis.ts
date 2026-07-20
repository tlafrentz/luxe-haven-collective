import {
  ObservationBuilder,
  type AnyObservation,
} from "@/platform/observations";

import type {
  ComparableAnalysis,
} from "../../domain/entities/comparable-analysis";

import {
  COUNT_UNIT,
  CURRENCY_UNIT,
  MARKET_OBSERVATION_SOURCE,
  PERCENTAGE_UNIT,
  RATIO_UNIT,
  createMarketObservationSubject,
} from "../types/market-observation-shared";

import {
  MARKET_OBSERVATION_TYPES,
} from "../types/market-observation-types";

export function mapComparableAnalysis(
  analysis: ComparableAnalysis,
  recordedAt: Date,
): readonly AnyObservation[] {
  const subject =
    createMarketObservationSubject(
      analysis.subject,
    );

  const observations: AnyObservation[] = [
    ObservationBuilder.create()
      .withType(
        MARKET_OBSERVATION_TYPES.comparableCount,
      )
      .concerning(subject)
      .withLabel("Comparable count")
      .withValue(analysis.comparableCount)
      .fromSource(MARKET_OBSERVATION_SOURCE)
      .observedAt(analysis.analyzedAt)
      .recordedAt(recordedAt)
      .measuredIn(COUNT_UNIT)
      .withProvenance({
        retrievedAt: recordedAt,
        effectiveAt: analysis.analyzedAt,
        notes:
          "Mapped from Market Intelligence comparable analysis.",
      })
      .build(),

    ObservationBuilder.create()
      .withType(
        MARKET_OBSERVATION_TYPES.averageSimilarity,
      )
      .concerning(subject)
      .withLabel(
        "Average comparable similarity",
      )
      .withValue(analysis.averageSimilarity)
      .fromSource(MARKET_OBSERVATION_SOURCE)
      .observedAt(analysis.analyzedAt)
      .recordedAt(recordedAt)
      .measuredIn(PERCENTAGE_UNIT)
      .withProvenance({
        retrievedAt: recordedAt,
        effectiveAt: analysis.analyzedAt,
        notes:
          "Mapped from Market Intelligence comparable analysis.",
      })
      .build(),

    ObservationBuilder.create()
      .withType(
        MARKET_OBSERVATION_TYPES.totalComparableWeight,
      )
      .concerning(subject)
      .withLabel("Total comparable weight")
      .withValue(analysis.totalWeight)
      .fromSource(MARKET_OBSERVATION_SOURCE)
      .observedAt(analysis.analyzedAt)
      .recordedAt(recordedAt)
      .measuredIn(RATIO_UNIT)
      .withProvenance({
        retrievedAt: recordedAt,
        effectiveAt: analysis.analyzedAt,
        notes:
          "Mapped from Market Intelligence comparable analysis.",
      })
      .build(),
  ];

  if (
    analysis.weightedEstimatedValue !==
    undefined
  ) {
    observations.push(
      ObservationBuilder.create()
        .withType(
          MARKET_OBSERVATION_TYPES
            .weightedEstimatedValue,
        )
        .concerning(subject)
        .withLabel(
          "Weighted estimated value",
        )
        .withValue(
          analysis.weightedEstimatedValue,
        )
        .fromSource(MARKET_OBSERVATION_SOURCE)
        .observedAt(analysis.analyzedAt)
        .recordedAt(recordedAt)
        .measuredIn(CURRENCY_UNIT)
        .withProvenance({
          retrievedAt: recordedAt,
          effectiveAt: analysis.analyzedAt,
          notes:
            "Mapped from Market Intelligence comparable analysis.",
        })
        .build(),
    );
  }

  return observations;
}
