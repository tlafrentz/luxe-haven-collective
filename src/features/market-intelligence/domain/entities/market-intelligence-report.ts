import { ConfidenceScore } from "../value-objects/confidence-score";
import { ComparableProperty } from "./comparable-property";
import { MarketObservation } from "./market-observation";
import { MarketProfile } from "./market-profile";

export class MarketIntelligenceReport {
  constructor(
    readonly market: MarketProfile,
    readonly observations: readonly MarketObservation[],
    readonly comparables: readonly ComparableProperty[],
    readonly overallConfidence: ConfidenceScore,
    readonly generatedAt: Date = new Date(),
  ) {}

  get observationCount(): number {
    return this.observations.length;
  }

  get comparableCount(): number {
    return this.comparables.length;
  }

  get isHighConfidence(): boolean {
    return this.overallConfidence.value >= 75;
  }
}
