import {
  ObservationBuilder,
  type AnyObservation,
} from "@/platform/observations";

import type {
  InvestmentDecision,
} from "../../domain/investment-decision";

import {
  INVESTMENT_OBSERVATION_SOURCE,
  createInvestmentObservationSubject,
} from "../types/investment-observation-shared";

import {
  INVESTMENT_OBSERVATION_TYPES,
  type InvestmentObservationType,
} from "../types/investment-observation-types";

export function mapInvestmentDecision(
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
          .decision.recommendation,
      label: "Acquisition recommendation",
      value: decision.recommendation,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .decision.confidence,
      label: "Decision confidence",
      value: decision.confidence,
    }),
  ];

  function build({
    type,
    label,
    value,
  }: {
    type: InvestmentObservationType;
    label: string;
    value: string;
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
      .withProvenance({
        retrievedAt: recordedAt,
        effectiveAt: recordedAt,
        notes:
          "Mapped from the Investment Intelligence acquisition decision.",
      })
      .build();
  }
}
