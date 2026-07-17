import type { Money, Percentage } from "../value-objects";
import { AcquisitionType } from "../enums";

export interface PurchaseAssumptions {
  readonly acquisitionType: AcquisitionType.Purchase;

  readonly downPayment: Percentage;

  readonly interestRate: Percentage;

  readonly loanTermYears: number;

  readonly closingCosts: Money;

  readonly estimatedTaxes: Money;

  readonly estimatedInsurance: Money;
}
