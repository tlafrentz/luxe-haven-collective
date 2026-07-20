import {
  ObservationBuilder,
  type AnyObservation,
} from "@/platform/observations";

import type {
  InvestmentDecision,
} from "../../domain/investment-decision";

import type {
  RevenueProjection,
} from "../../domain/entities/revenue-projection";

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

export function mapRevenueProjection(
  projection: RevenueProjection,
  decision: InvestmentDecision,
  recordedAt: Date,
): readonly AnyObservation[] {
  const subject =
    createInvestmentObservationSubject(
      decision,
    );

  return [
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .revenue.projectedAdr,
      label: "Projected average daily rate",
      value: projection.projectedAdr.amount,
      unit: INVESTMENT_CURRENCY_UNIT,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .revenue.projectedOccupancy,
      label: "Projected occupancy",
      value:
        projection.projectedOccupancy.value,
      unit: INVESTMENT_PERCENTAGE_UNIT,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .revenue.projectedMonthlyRevenue,
      label: "Projected monthly revenue",
      value:
        projection.projectedMonthlyRevenue
          .amount,
      unit: INVESTMENT_CURRENCY_UNIT,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .revenue.projectedAnnualRevenue,
      label: "Projected annual revenue",
      value:
        projection.projectedAnnualRevenue
          .amount,
      unit: INVESTMENT_CURRENCY_UNIT,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .revenue.confidence,
      label: "Revenue projection confidence",
      value: projection.confidence.value,
      unit: INVESTMENT_PERCENTAGE_UNIT,
    }),
  ];

  function build({
    type,
    label,
    value,
    unit,
  }: {
    type: InvestmentObservationType;
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
      .fromSource(
        INVESTMENT_OBSERVATION_SOURCE,
      )
      .observedAt(recordedAt)
      .recordedAt(recordedAt)
      .measuredIn(unit)
      .withProvenance({
        retrievedAt: recordedAt,
        effectiveAt: recordedAt,
        notes:
          "Mapped from the Investment Intelligence revenue projection.",
      })
      .build();
  }
}
