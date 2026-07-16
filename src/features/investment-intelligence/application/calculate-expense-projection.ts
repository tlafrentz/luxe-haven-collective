import type {
  ExpenseProjection,
  Money,
  Percentage,
} from "../domain";

import {
  assertMoney,
  assertPercentage,
  roundCurrency,
} from "./calculation-guards";

export type CalculateExpenseProjectionInput = {
  mortgage: Money;
  cleaning: Money;
  utilities: Money;
  insurance: Money;
  taxes: Money;
  management: Money;
  maintenance: Money;
  software: Money;
  supplies: Money;
  capitalReserve: Money;
  confidence: Percentage;
};

const OPERATING_EXPENSE_FIELDS = [
  "cleaning",
  "utilities",
  "insurance",
  "taxes",
  "management",
  "maintenance",
  "software",
  "supplies",
  "capitalReserve",
] as const;

export function calculateExpenseProjection(
  input: CalculateExpenseProjectionInput,
): ExpenseProjection {
  assertMoney(
    input.mortgage,
    "Mortgage",
  );

  for (const field of OPERATING_EXPENSE_FIELDS) {
    assertMoney(
      input[field],
      formatFieldName(field),
    );
  }

  assertPercentage(
    input.confidence,
    "Confidence",
  );

  const totalOperatingExpenses =
    roundCurrency(
      OPERATING_EXPENSE_FIELDS.reduce(
        (total, field) =>
          total + input[field].amount,
        0,
      ),
    );

  return {
    mortgage: input.mortgage,
    cleaning: input.cleaning,
    utilities: input.utilities,
    insurance: input.insurance,
    taxes: input.taxes,
    management: input.management,
    maintenance: input.maintenance,
    software: input.software,
    supplies: input.supplies,
    capitalReserve:
      input.capitalReserve,
    totalOperatingExpenses: {
      amount: totalOperatingExpenses,
      currency: "USD",
    },
    confidence: input.confidence,
  };
}

function formatFieldName(
  field: string,
): string {
  return field
    .replace(
      /([A-Z])/g,
      " $1",
    )
    .replace(/^./, (character) =>
      character.toUpperCase(),
    );
}
