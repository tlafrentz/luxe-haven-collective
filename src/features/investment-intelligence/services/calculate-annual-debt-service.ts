import {
  calculatePurchaseDebtService,
} from "../application/calculate-purchase-debt-service";

export interface CalculateAnnualDebtServiceInput {
  readonly purchasePrice: number;
  readonly downPaymentPercentage: number;
  readonly annualInterestRatePercentage:
    number;
  readonly loanTermYears: number;
}

/**
 * Backward-compatible adapter for the existing purchase report builder.
 *
 * The detailed amortization result is now produced by
 * calculatePurchaseDebtService. Existing callers can continue consuming the
 * annual debt-service number until the richer purchase report is wired.
 */
export function calculateAnnualDebtService(
  input:
    CalculateAnnualDebtServiceInput,
): number {
  return calculatePurchaseDebtService(
    input,
  ).annualDebtService.amount;
}
