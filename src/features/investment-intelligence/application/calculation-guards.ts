import type {
  Money,
  Percentage,
} from "../domain";

export function assertFiniteNonNegative(
  value: number,
  fieldName: string,
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `${fieldName} must be a finite, non-negative number.`,
    );
  }
}

export function assertMoney(
  money: Money,
  fieldName: string,
): void {
  if (money.currency !== "USD") {
    throw new Error(
      `${fieldName} must use USD.`,
    );
  }

  assertFiniteNonNegative(
    money.amount,
    fieldName,
  );
}

export function assertPercentage(
  percentage: Percentage,
  fieldName: string,
): void {
  if (
    !Number.isFinite(percentage.value) ||
    percentage.value < 0 ||
    percentage.value > 100
  ) {
    throw new Error(
      `${fieldName} must be between 0 and 100.`,
    );
  }
}

export function roundCurrency(
  value: number,
): number {
  return (
    Math.round(
      (value + Number.EPSILON) * 100,
    ) / 100
  );
}
