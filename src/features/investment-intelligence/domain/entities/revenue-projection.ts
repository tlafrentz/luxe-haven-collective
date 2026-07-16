import type { Money, Percentage } from "../value-objects";

export interface RevenueProjection {
  readonly projectedAdr: Money;
  readonly projectedOccupancy: Percentage;

  readonly projectedMonthlyRevenue: Money;
  readonly projectedAnnualRevenue: Money;

  readonly confidence: Percentage;
}
