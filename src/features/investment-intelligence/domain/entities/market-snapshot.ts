import { MarketTrend } from "../enums";
import type { Money, Percentage } from "../value-objects";

export interface MarketSnapshot {
  readonly market: string;
  readonly submarket?: string;
  readonly medianAdr: Money;
  readonly medianOccupancy: Percentage;
  readonly trend: MarketTrend;
  readonly supplyGrowth?: Percentage;
  readonly demandGrowth?: Percentage;
  readonly seasonality?: string;
}

