import { RiskSeverity } from "../enums";
import type { Money, Percentage } from "../value-objects";

export interface InvestmentRisk {
  readonly id: string;
  readonly title: string;
  readonly description: string;

  readonly severity: RiskSeverity;
  readonly probability: Percentage;
  readonly estimatedFinancialImpact?: Money;

  readonly mitigation?: string;
}
