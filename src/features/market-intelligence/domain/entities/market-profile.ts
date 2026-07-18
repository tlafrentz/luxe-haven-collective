import { Money } from "@/features/investment-intelligence/domain/value-objects";
import { Percentage } from "@/features/investment-intelligence/domain/value-objects";

import { MarketObservation } from "./market-observation";
import { ComparableProperty } from "./comparable-property";

export class MarketProfile {
  constructor(
    readonly location: string,

    readonly projectedAdr: Money,
    readonly projectedOccupancy: Percentage,
    readonly projectedAnnualRevenue: Money,

    readonly marketTrend: string,

    readonly observations: readonly MarketObservation[],

    readonly comparables: readonly ComparableProperty[],
  ) {}
}
