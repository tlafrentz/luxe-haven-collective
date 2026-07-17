import type {
  Money,
  Percentage,
} from "../value-objects";

export interface AcquisitionStrategy {
  readonly targetOfferPrice: Money;
  readonly maximumPurchasePrice: Money;
  readonly walkAwayPrice: Money;

  readonly requiredAverageDailyRate: Money;
  readonly requiredOccupancy: Percentage;
  readonly requiredAnnualRevenue: Money;
  readonly requiredNetOperatingIncome: Money;

  readonly expectedAnnualUpside: Money;

  readonly primaryOpportunity: string;
  readonly primaryRisk: string;

  readonly firstNinetyDayPriorities:
    readonly string[];
}
