import type { Money } from "../value-objects";
import { AcquisitionType } from "../enums";

export interface RentalArbitrageAssumptions {
  readonly acquisitionType: AcquisitionType.RentalArbitrage;

  readonly monthlyLease: Money;

  readonly securityDeposit: Money;

  readonly leaseTermMonths: number;

  readonly furnishingBudget: Money;

  readonly startupCosts: Money;

  readonly utilitiesIncluded: boolean;
}
