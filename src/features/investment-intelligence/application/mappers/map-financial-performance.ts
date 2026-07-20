import {
  ObservationBuilder,
  type AnyObservation,
} from "@/platform/observations";

import type {
  InvestmentDecision,
} from "../../domain/investment-decision";

import type {
  FinancialPerformance,
} from "../../domain/entities/financial-performance";

import {
  INVESTMENT_CURRENCY_UNIT,
  INVESTMENT_OBSERVATION_SOURCE,
  INVESTMENT_PERCENTAGE_UNIT,
  INVESTMENT_RATIO_UNIT,
  createInvestmentObservationSubject,
} from "../types/investment-observation-shared";

import {
  INVESTMENT_OBSERVATION_TYPES,
  type InvestmentObservationType,
} from "../types/investment-observation-types";

export function mapFinancialPerformance(
  performance: FinancialPerformance,
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
          .financial.netOperatingIncome,
      label: "Net operating income",
      value:
        performance.netOperatingIncome
          .amount,
      unit: INVESTMENT_CURRENCY_UNIT,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .financial.annualCashFlow,
      label: "Annual cash flow",
      value: performance.annualCashFlow.amount,
      unit: INVESTMENT_CURRENCY_UNIT,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .financial.capRate,
      label: "Capitalization rate",
      value: performance.capRate.value,
      unit: INVESTMENT_PERCENTAGE_UNIT,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .financial.cashOnCashReturn,
      label: "Cash-on-cash return",
      value:
        performance.cashOnCashReturn.value,
      unit: INVESTMENT_PERCENTAGE_UNIT,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .financial
          .debtServiceCoverageRatio,
      label: "Debt-service coverage ratio",
      value:
        performance
          .debtServiceCoverageRatio,
      unit: INVESTMENT_RATIO_UNIT,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .financial.breakEvenOccupancy,
      label: "Break-even occupancy",
      value:
        performance.breakEvenOccupancy
          .value,
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
          "Mapped from Investment Intelligence financial performance.",
      })
      .build();
  }
}
