import type {
  PurchaseDebtService,
} from "../domain/entities/purchase-debt-service";

export interface CalculatePurchaseDebtServiceInput {
  readonly purchasePrice: number;
  readonly downPaymentPercentage: number;
  readonly annualInterestRatePercentage:
    number;
  readonly loanTermYears: number;
}

function roundCurrency(
  amount: number,
): number {
  return (
    Math.round(
      (amount + Number.EPSILON) * 100,
    ) / 100
  );
}

function roundPercentage(
  value: number,
): number {
  return (
    Math.round(
      (value + Number.EPSILON) * 100,
    ) / 100
  );
}

function usd(amount: number) {
  return {
    amount: roundCurrency(amount),
    currency: "USD" as const,
  };
}

function percentage(value: number) {
  return {
    value: roundPercentage(value),
  };
}

function assertFiniteNonNegative(
  value: number,
  fieldName: string,
): void {
  if (
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new Error(
      `${fieldName} must be a finite, non-negative number.`,
    );
  }
}

function validateInput({
  purchasePrice,
  downPaymentPercentage,
  annualInterestRatePercentage,
  loanTermYears,
}: CalculatePurchaseDebtServiceInput): void {
  if (
    !Number.isFinite(purchasePrice) ||
    purchasePrice <= 0
  ) {
    throw new Error(
      "purchasePrice must be a finite number greater than zero.",
    );
  }

  assertFiniteNonNegative(
    downPaymentPercentage,
    "downPaymentPercentage",
  );

  if (downPaymentPercentage > 100) {
    throw new Error(
      "downPaymentPercentage cannot exceed 100.",
    );
  }

  assertFiniteNonNegative(
    annualInterestRatePercentage,
    "annualInterestRatePercentage",
  );

  if (
    !Number.isInteger(loanTermYears) ||
    loanTermYears <= 0
  ) {
    throw new Error(
      "loanTermYears must be a positive integer.",
    );
  }
}

function calculateMonthlyPayment({
  principal,
  monthlyInterestRate,
  totalPayments,
}: {
  readonly principal: number;
  readonly monthlyInterestRate: number;
  readonly totalPayments: number;
}): number {
  if (principal === 0) {
    return 0;
  }

  if (monthlyInterestRate === 0) {
    return principal / totalPayments;
  }

  const growthFactor =
    (
      1 + monthlyInterestRate
    ) ** totalPayments;

  return (
    principal *
    (
      monthlyInterestRate *
      growthFactor
    )
  ) /
  (
    growthFactor - 1
  );
}

export function calculatePurchaseDebtService({
  purchasePrice,
  downPaymentPercentage,
  annualInterestRatePercentage,
  loanTermYears,
}: CalculatePurchaseDebtServiceInput): PurchaseDebtService {
  validateInput({
    purchasePrice,
    downPaymentPercentage,
    annualInterestRatePercentage,
    loanTermYears,
  });

  const downPaymentAmount =
    purchasePrice *
    (
      downPaymentPercentage /
      100
    );

  const loanAmount =
    purchasePrice -
    downPaymentAmount;

  const monthlyInterestRateDecimal =
    (
      annualInterestRatePercentage /
      100
    ) /
    12;

  const totalPayments =
    loanTermYears * 12;

  const monthlyPrincipalAndInterest =
    calculateMonthlyPayment({
      principal: loanAmount,
      monthlyInterestRate:
        monthlyInterestRateDecimal,
      totalPayments,
    });

  const annualDebtService =
    monthlyPrincipalAndInterest * 12;

  const totalLoanPayments =
    monthlyPrincipalAndInterest *
    totalPayments;

  const totalInterestPaid =
    totalLoanPayments -
    loanAmount;

  const loanToValueRatio =
    (
      loanAmount /
      purchasePrice
    ) *
    100;

  return {
    purchasePrice:
      usd(purchasePrice),
    downPaymentAmount:
      usd(downPaymentAmount),
    downPaymentPercentage:
      percentage(
        downPaymentPercentage,
      ),
    loanAmount:
      usd(loanAmount),
    loanToValueRatio:
      percentage(
        loanToValueRatio,
      ),
    annualInterestRate:
      percentage(
        annualInterestRatePercentage,
      ),
    monthlyInterestRate:
      percentage(
        annualInterestRatePercentage /
          12,
      ),
    loanTermYears,
    totalPayments,
    monthlyPrincipalAndInterest:
      usd(
        monthlyPrincipalAndInterest,
      ),
    annualDebtService:
      usd(annualDebtService),
    totalPrincipalPaid:
      usd(loanAmount),
    totalInterestPaid:
      usd(totalInterestPaid),
    totalLoanPayments:
      usd(totalLoanPayments),
  };
}
