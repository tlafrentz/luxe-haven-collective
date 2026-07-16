import type { Money, Percentage } from "../value-objects";

export interface FinancialPerformance {
  readonly netOperatingIncome: Money;
  readonly annualCashFlow: Money;

  readonly capRate: Percentage;
  readonly cashOnCashReturn: Percentage;

  readonly debtServiceCoverageRatio: number;

  readonly breakEvenOccupancy: Percentage;
}
