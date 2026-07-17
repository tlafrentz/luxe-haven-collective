import type {
  Money,
  Percentage,
} from "../value-objects";

export type FailurePointStatus =
  | "strong-buffer"
  | "moderate-buffer"
  | "thin-buffer"
  | "at-risk";

export interface RentalArbitrageFailurePoints {
  /**
   * Highest monthly lease the projected operating plan can support
   * before annual cash flow reaches zero.
   */
  readonly maximumMonthlyLease: Money;

  /**
   * Difference between the maximum sustainable monthly lease and
   * the current monthly lease.
   */
  readonly monthlyLeaseSafetyMargin: Money;

  /**
   * Percentage by which the current monthly lease could increase
   * before annual cash flow reaches zero.
   */
  readonly monthlyLeaseSafetyMarginPercentage:
    Percentage;

  /**
   * Lowest occupancy supported at the current projected ADR before
   * annual cash flow reaches zero.
   */
  readonly minimumOccupancy: Percentage;

  /**
   * Difference between projected occupancy and minimum occupancy.
   */
  readonly occupancySafetyMarginPoints:
    number;

  /**
   * Lowest ADR supported at the current projected occupancy before
   * annual cash flow reaches zero.
   */
  readonly minimumAdr: Money;

  /**
   * Difference between projected ADR and minimum ADR.
   */
  readonly adrSafetyMargin: Money;

  /**
   * Percentage by which projected ADR could decline before annual
   * cash flow reaches zero.
   */
  readonly adrSafetyMarginPercentage:
    Percentage;

  /**
   * Additional annual operating expense the plan can absorb before
   * annual cash flow reaches zero.
   */
  readonly operatingExpenseSafetyMargin:
    Money;

  readonly status: FailurePointStatus;
  readonly summary: string;
}
