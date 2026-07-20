import {
  ObservationBuilder,
  type AnyObservation,
} from "@/platform/observations";

import type {
  ComparableSubject,
} from "../../domain/entities/comparable-subject";

import type {
  MarketValuation,
} from "../../domain/entities/market-valuation";

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

export function mapMarketValuation(
  valuation: MarketValuation,
  subjectInput: ComparableSubject,
  recordedAt: Date,
): readonly AnyObservation[] {
  const subject =
    createMarketObservationSubject(
      subjectInput,
    );

  const observedAt =
    valuation.calculatedAt;

  return [
    build({
      type:
        MARKET_OBSERVATION_TYPES.estimatedValue,
      label: "Estimated market value",
      value:
        valuation.valueRange.estimated,
      unit: CURRENCY_UNIT,
    }),
    build({
      type:
        MARKET_OBSERVATION_TYPES.valuationLow,
      label: "Valuation low",
      value: valuation.valueRange.low,
      unit: CURRENCY_UNIT,
    }),
    build({
      type:
        MARKET_OBSERVATION_TYPES.valuationHigh,
      label: "Valuation high",
      value: valuation.valueRange.high,
      unit: CURRENCY_UNIT,
    }),
    build({
      type:
        MARKET_OBSERVATION_TYPES
          .valuationSpread,
      label: "Valuation spread",
      value: valuation.valueRange.spread,
      unit: CURRENCY_UNIT,
    }),
    build({
      type:
        MARKET_OBSERVATION_TYPES
          .valuationSpreadRatio,
      label: "Valuation spread ratio",
      value:
        valuation.valueRange.spreadRatio,
      unit: RATIO_UNIT,
    }),
    build({
      type:
        MARKET_OBSERVATION_TYPES
          .valuationConfidence,
      label: "Valuation confidence",
      value: valuation.confidence.score,
      unit: PERCENTAGE_UNIT,
    }),
    build({
      type:
        MARKET_OBSERVATION_TYPES
          .valuationComparableCount,
      label:
        "Valuation comparable count",
      value:
        valuation.confidence
          .comparableCount,
      unit: COUNT_UNIT,
    }),
    build({
      type:
        MARKET_OBSERVATION_TYPES
          .valuationAverageSimilarity,
      label:
        "Valuation average similarity",
      value:
        valuation.confidence
          .averageSimilarity,
      unit: PERCENTAGE_UNIT,
    }),
    build({
      type:
        MARKET_OBSERVATION_TYPES
          .valuationDispersionRatio,
      label:
        "Valuation dispersion ratio",
      value:
        valuation.confidence
          .dispersionRatio,
      unit: RATIO_UNIT,
    }),
  ];

  function build({
    type,
    label,
    value,
    unit,
  }: {
    type: string;
    label: string;
    value: number;
    unit: {
      type: string;
      symbol?: string;
    };
  }): AnyObservation {
    return ObservationBuilder.create()
      .withType(type)
      .concerning(subject)
      .withLabel(label)
      .withValue(value)
      .fromSource(MARKET_OBSERVATION_SOURCE)
      .observedAt(observedAt)
      .recordedAt(recordedAt)
      .measuredIn(unit)
      .withProvenance({
        retrievedAt: recordedAt,
        effectiveAt: observedAt,
        notes:
          "Mapped from Market Intelligence valuation.",
      })
      .withMetadata({
        confidenceLevel:
          valuation.confidence.level,
        excludedComparableCount:
          valuation.excludedComparableIds
            .length,
      })
      .build();
  }
}
