import type {
  Money,
  Percentage,
} from "../value-objects";

export type RentalArbitrageStressEventType =
  | "supply-surge"
  | "demand-slowdown"
  | "price-compression"
  | "regulatory-constraint"
  | "cleaning-cost-inflation"
  | "insurance-cost-inflation"
  | "pricing-underperformance";

export type RentalArbitrageStressOutcome =
  | "resilient"
  | "pressured"
  | "fails";

export interface RentalArbitrageStressAssumptions {
  readonly adrChangePercentage: number;
  readonly occupancyChangePoints: number;
  readonly operatingExpenseChangePercentage:
    number;
}

export interface RentalArbitrageStressTest {
  readonly id: string;
  readonly type:
    RentalArbitrageStressEventType;
  readonly title: string;
  readonly description: string;
  readonly assumptions:
    RentalArbitrageStressAssumptions;

  readonly stressedAdr: Money;
  readonly stressedOccupancy: Percentage;
  readonly stressedAnnualRevenue: Money;
  readonly stressedAnnualOperatingExpenses:
    Money;
  readonly stressedAnnualCashFlow: Money;

  readonly annualCashFlowChange: Money;
  readonly cashFlowMargin: Percentage;
  readonly leaseCoverageRatio: number;
  readonly outcome:
    RentalArbitrageStressOutcome;

  /**
   * Explains the operating consequence of this stress event.
   */
  readonly interpretation: string;
}

export interface RentalArbitrageStressTestSummary {
  readonly tests:
    readonly RentalArbitrageStressTest[];
  readonly mostDamagingStress:
    RentalArbitrageStressTest;
  readonly failedStressCount: number;
  readonly pressuredStressCount: number;
  readonly resilientStressCount: number;
  readonly overallOutcome:
    RentalArbitrageStressOutcome;
  readonly summary: string;
}
