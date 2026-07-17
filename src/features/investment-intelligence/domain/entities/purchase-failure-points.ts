import type {
  Money,
  Percentage,
} from "../value-objects";

export type PurchaseResilienceStatus =
  | "strong"
  | "moderate"
  | "fragile"
  | "failing";

export interface PurchaseFailurePoints {
  readonly minimumSustainableAdr: Money;
  readonly adrSafetyMargin: Money;
  readonly adrSafetyMarginPercentage:
    Percentage;

  readonly minimumSustainableOccupancy:
    Percentage;
  readonly occupancySafetyMargin:
    Percentage;

  readonly maximumAnnualOperatingExpenses:
    Money;
  readonly operatingExpenseCapacity:
    Money;

  readonly maximumAnnualDebtService:
    Money;
  readonly debtServiceCapacity: Money;

  readonly maximumSupportedLoanAmount:
    Money;
  readonly maximumSupportedPurchasePrice:
    Money;
  readonly purchasePriceSafetyMargin:
    Money;

  readonly resilienceStatus:
    PurchaseResilienceStatus;
  readonly summary: string;
}
