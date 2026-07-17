import type {
  Money,
  Percentage,
} from "../value-objects";

export interface PurchaseDebtService {
  readonly purchasePrice: Money;
  readonly downPaymentAmount: Money;
  readonly downPaymentPercentage:
    Percentage;

  readonly loanAmount: Money;
  readonly loanToValueRatio: Percentage;

  readonly annualInterestRate:
    Percentage;
  readonly monthlyInterestRate:
    Percentage;
  readonly loanTermYears: number;
  readonly totalPayments: number;

  readonly monthlyPrincipalAndInterest:
    Money;
  readonly annualDebtService: Money;

  readonly totalPrincipalPaid: Money;
  readonly totalInterestPaid: Money;
  readonly totalLoanPayments: Money;
}
