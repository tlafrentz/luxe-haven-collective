import type { MarketMoney as Money, MarketPercentage as Percentage } from "../value-objects/market-metric-types";

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
