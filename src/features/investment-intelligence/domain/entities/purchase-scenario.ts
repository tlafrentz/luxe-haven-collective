import type {
  Money,
  Percentage,
} from "../value-objects";

export type PurchaseScenarioType =
  | "downside"
  | "base"
  | "upside";

export interface PurchaseScenarioAssumptions {
  readonly adrChangePercentage: number;
  readonly occupancyChangePoints: number;
  readonly operatingExpenseChangePercentage:
    number;
}

export interface PurchaseScenario {
  readonly type: PurchaseScenarioType;
  readonly label: string;
  readonly assumptions:
    PurchaseScenarioAssumptions;

  readonly projectedAdr: Money;
  readonly projectedOccupancy: Percentage;
  readonly annualRevenue: Money;
  readonly annualOperatingExpenses: Money;
  readonly netOperatingIncome: Money;
  readonly annualDebtService: Money;
  readonly annualCashFlow: Money;

  readonly cashFlowChangeFromBase: Money;
  readonly capRate: Percentage;
  readonly cashOnCashReturn: Percentage;
  readonly debtServiceCoverageRatio: number;
  readonly breakEvenOccupancy: Percentage;
}
