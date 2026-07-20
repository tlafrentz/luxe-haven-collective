import {
  ObservationBuilder,
  type AnyObservation,
} from "@/platform/observations";

import type {
  InvestmentDecision,
} from "../../domain/investment-decision";

import type {
  ExpenseProjection,
} from "../../domain/entities/expense-projection";

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

export function mapExpenseProjection(
  projection: ExpenseProjection,
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
          .expenses.mortgage,
      label: "Annual mortgage expense",
      value: projection.mortgage.amount,
    }),
    buildCurrency({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .expenses.cleaning,
      label: "Annual cleaning expense",
      value: projection.cleaning.amount,
    }),
    buildCurrency({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .expenses.utilities,
      label: "Annual utilities expense",
      value: projection.utilities.amount,
    }),
    buildCurrency({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .expenses.insurance,
      label: "Annual insurance expense",
      value: projection.insurance.amount,
    }),
    buildCurrency({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .expenses.taxes,
      label: "Annual tax expense",
      value: projection.taxes.amount,
    }),
    buildCurrency({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .expenses.management,
      label: "Annual management expense",
      value: projection.management.amount,
    }),
    buildCurrency({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .expenses.maintenance,
      label: "Annual maintenance expense",
      value: projection.maintenance.amount,
    }),
    buildCurrency({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .expenses.software,
      label: "Annual software expense",
      value: projection.software.amount,
    }),
    buildCurrency({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .expenses.supplies,
      label: "Annual supplies expense",
      value: projection.supplies.amount,
    }),
    buildCurrency({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .expenses.capitalReserve,
      label: "Annual capital reserve",
      value:
        projection.capitalReserve.amount,
    }),
    buildCurrency({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .expenses.totalOperatingExpenses,
      label: "Total operating expenses",
      value:
        projection.totalOperatingExpenses
          .amount,
    }),
    build({
      type:
        INVESTMENT_OBSERVATION_TYPES
          .expenses.confidence,
      label: "Expense projection confidence",
      value: projection.confidence.value,
      unit: INVESTMENT_PERCENTAGE_UNIT,
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
          "Mapped from the Investment Intelligence expense projection.",
      })
      .build();
  }
}
