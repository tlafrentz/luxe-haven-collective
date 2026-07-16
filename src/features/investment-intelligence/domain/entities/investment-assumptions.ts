import type { Money, Percentage } from "../value-objects";

export interface InvestmentAssumptions {
  readonly downPayment: Percentage;
  readonly interestRate: Percentage;
  readonly loanTermYears: number;

  readonly averageLengthOfStay: number;

  readonly managementFee: Percentage;

  readonly maintenanceReserve: Percentage;

  readonly capitalReserve: Percentage;

  readonly estimatedUtilities: Money;

  readonly estimatedInsurance: Money;

  readonly estimatedTaxes: Money;
}
