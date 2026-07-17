import type {
  AcquisitionRecommendation,
} from "../enums";

import type {
  Money,
  Percentage,
} from "../value-objects";

export type InvestmentScenarioType =
  | "downside"
  | "base"
  | "upside";

export interface InvestmentScenarioAssumptions {
  readonly adrChangePercentage: number;
  readonly occupancyChangePoints: number;
  readonly operatingExpenseChangePercentage: number;
}

export interface InvestmentScenario {
  readonly type: InvestmentScenarioType;
  readonly label: string;
  readonly description: string;
  readonly assumptions:
    InvestmentScenarioAssumptions;

  readonly projectedAdr: Money;
  readonly projectedOccupancy: Percentage;
  readonly projectedAnnualRevenue: Money;
  readonly totalAnnualExpenses: Money;
  readonly annualCashFlow: Money;
  readonly cashFlowChangeFromBase: Money;

  readonly cashOnCashReturn: Percentage;
  readonly leaseCoverageRatio: number;
  readonly breakEvenOccupancy: Percentage;

  readonly recommendation:
    AcquisitionRecommendation;
}
