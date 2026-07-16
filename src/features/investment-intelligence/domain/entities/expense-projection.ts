import type { Money, Percentage } from "../value-objects";

export interface ExpenseProjection {
  readonly mortgage: Money;
  readonly cleaning: Money;
  readonly utilities: Money;
  readonly insurance: Money;
  readonly taxes: Money;
  readonly management: Money;
  readonly maintenance: Money;
  readonly software: Money;
  readonly supplies: Money;
  readonly capitalReserve: Money;

  readonly totalOperatingExpenses: Money;

  readonly confidence: Percentage;
}
