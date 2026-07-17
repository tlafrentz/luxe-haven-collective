import type {
  Money,
  Percentage,
} from "../value-objects";

export interface RentalArbitrageExpenseProjection {
  readonly lease: Money;

  readonly cleaning: Money;
  readonly utilities: Money;
  readonly insurance: Money;
  readonly management: Money;
  readonly maintenance: Money;
  readonly software: Money;
  readonly supplies: Money;
  readonly capitalReserve: Money;

  /**
   * Excludes the lease payment so operators can distinguish
   * property operations from the fixed occupancy commitment.
   */
  readonly totalOperatingExpenses: Money;

  /**
   * Includes both the annual lease expense and all operating expenses.
   */
  readonly totalAnnualExpenses: Money;

  readonly confidence: Percentage;
}
