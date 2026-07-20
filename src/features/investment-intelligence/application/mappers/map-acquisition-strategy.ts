import {
  ObservationBuilder,
  type AnyObservation,
  type ObservationValue,
} from "@/platform/observations";

import type {
  InvestmentDecision,
} from "../../domain/investment-decision";

import type {
  AcquisitionStrategy,
} from "../../domain/entities/acquisition-strategy";

import {
  INVESTMENT_CURRENCY_UNIT,
  INVESTMENT_OBSERVATION_SOURCE,
  INVESTMENT_PERCENTAGE_UNIT,
  createInvestmentObservationSubject,
} from "../types/investment-observation-shared";

import {
  INVESTMENT_OBSERVATION_TYPES,
  type InvestmentObservationType,
} from "../types/investment-observation-types";

export function mapAcquisitionStrategy(
  strategy: AcquisitionStrategy,
  decision: InvestmentDecision,
  recordedAt: Date,
): readonly AnyObservation[] {
  const subject =
    createInvestmentObservationSubject(
      decision,
    );

  return [
    buildCurrency({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .strategy.targetOfferPrice,
      label: "Target offer price",
      value: strategy.targetOfferPrice.amount,
    }),
    buildCurrency({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .strategy.maximumPurchasePrice,
      label: "Maximum purchase price",
      value:
        strategy.maximumPurchasePrice.amount,
    }),
    buildCurrency({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .strategy.walkAwayPrice,
      label: "Walk-away price",
      value: strategy.walkAwayPrice.amount,
    }),
    buildCurrency({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .strategy
          .requiredAverageDailyRate,
      label: "Required average daily rate",
      value:
        strategy.requiredAverageDailyRate
          .amount,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .strategy.requiredOccupancy,
      label: "Required occupancy",
      value: strategy.requiredOccupancy.value,
      unit: INVESTMENT_PERCENTAGE_UNIT,
    }),
    buildCurrency({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .strategy.requiredAnnualRevenue,
      label: "Required annual revenue",
      value:
        strategy.requiredAnnualRevenue.amount,
    }),
    buildCurrency({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .strategy
          .requiredNetOperatingIncome,
      label:
        "Required net operating income",
      value:
        strategy.requiredNetOperatingIncome
          .amount,
    }),
    buildCurrency({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .strategy.expectedAnnualUpside,
      label: "Expected annual upside",
      value:
        strategy.expectedAnnualUpside.amount,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .strategy.primaryOpportunity,
      label: "Primary opportunity",
      value: strategy.primaryOpportunity,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .strategy.primaryRisk,
      label: "Primary risk",
      value: strategy.primaryRisk,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .strategy.firstNinetyDayPriority,
      label: "First 90-day priorities",
      value:
        strategy.firstNinetyDayPriorities,
    }),
  ];

  function buildCurrency({
    type,
    label,
    value,
  }: {
    type: InvestmentObservationType;
    label: string;
    value: number;
  }): AnyObservation {
    return build({
      type,
      label,
      value,
      unit: INVESTMENT_CURRENCY_UNIT,
    });
  }

  function build({
    type,
    label,
    value,
    unit,
  }: {
    type: InvestmentObservationType;
    label: string;
    value: ObservationValue;
    unit?: {
      type: string;
      symbol?: string;
    };
  }): AnyObservation {
    const builder = ObservationBuilder.create()
      .withType(type)
      .concerning(subject)
      .withLabel(label)
      .withValue(value)
      .fromSource(
        INVESTMENT_OBSERVATION_SOURCE,
      )
      .observedAt(recordedAt)
      .recordedAt(recordedAt)
      .withProvenance({
        retrievedAt: recordedAt,
        effectiveAt: recordedAt,
        notes:
          "Mapped from the Investment Intelligence acquisition strategy.",
      });

    return unit
      ? builder.measuredIn(unit).build()
      : builder.build();
  }
}
