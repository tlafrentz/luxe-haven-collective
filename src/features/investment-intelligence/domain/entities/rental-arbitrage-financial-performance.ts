import type {
  Money,
  Percentage,
} from "../value-objects";

export interface RentalArbitrageFinancialPerformance {
  readonly annualGrossRevenue: Money;
  readonly annualLeaseExpense: Money;
  readonly annualOperatingExpenses: Money;
  readonly totalAnnualExpenses: Money;

  readonly annualCashFlow: Money;
  readonly monthlyOperatingMargin: Money;

  readonly initialCashInvested: Money;
  readonly cashOnCashReturn: Percentage;

  /**
   * Revenue remaining after operating expenses divided by lease expense.
   * This measures the operating plan's capacity to support the lease.
   */
  readonly leaseCoverageRatio: number;

  readonly breakEvenOccupancy: Percentage;
}
