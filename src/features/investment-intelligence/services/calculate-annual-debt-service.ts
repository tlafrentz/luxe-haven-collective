export type CalculateAnnualDebtServiceInput = {
  readonly purchasePrice: number;
  readonly downPaymentPercentage: number;
  readonly annualInterestRatePercentage: number;
  readonly loanTermYears: number;
};

function assertFiniteNonNegative(
  value: number,
  fieldName: string,
): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `${fieldName} must be a finite, non-negative number.`,
    );
  }
}

export function calculateAnnualDebtService({
  purchasePrice,
  downPaymentPercentage,
  annualInterestRatePercentage,
  loanTermYears,
}: CalculateAnnualDebtServiceInput): number {
  assertFiniteNonNegative(
    purchasePrice,
    "Purchase price",
  );

  assertFiniteNonNegative(
    downPaymentPercentage,
    "Down payment percentage",
  );

  assertFiniteNonNegative(
    annualInterestRatePercentage,
    "Annual interest rate",
  );

  assertFiniteNonNegative(
    loanTermYears,
    "Loan term",
  );

  if (downPaymentPercentage > 100) {
    throw new Error(
      "Down payment percentage must not exceed 100.",
    );
  }

  if (purchasePrice === 0) {
    return 0;
  }

  const loanAmount =
    purchasePrice *
    (1 - downPaymentPercentage / 100);

  if (loanAmount === 0) {
    return 0;
  }

  if (loanTermYears === 0) {
    throw new Error(
      "Loan term must be greater than zero when financing is used.",
    );
  }

  const totalPayments =
    loanTermYears * 12;

  if (annualInterestRatePercentage === 0) {
    return (
      Math.round(
        (loanAmount / loanTermYears +
          Number.EPSILON) *
          100,
      ) / 100
    );
  }

  const monthlyInterestRate =
    annualInterestRatePercentage /
    100 /
    12;

  const monthlyPayment =
    loanAmount *
    (
      monthlyInterestRate *
      Math.pow(
        1 + monthlyInterestRate,
        totalPayments,
      )
    ) /
    (
      Math.pow(
        1 + monthlyInterestRate,
        totalPayments,
      ) - 1
    );

  return (
    Math.round(
      (monthlyPayment * 12 +
        Number.EPSILON) *
        100,
    ) / 100
  );
}
