import { ComparableProperty } from "./comparable-property";
import { MarketObservation } from "./market-observation";
import { MarketProfile } from "./market-profile";
import { ConfidenceScore } from "../value-objects/confidence-score";

/** @deprecated Compatibility projection; canonical analysis is Platform IntelligenceReport. */
export class MarketIntelligenceReport {
  readonly market: MarketProfile;
  readonly observations: readonly MarketObservation[];
  readonly comparables: readonly ComparableProperty[];
  readonly confidence: ConfidenceScore;

  constructor(
    market: MarketProfile,
    observations: readonly MarketObservation[],
    comparables: readonly ComparableProperty[],
    confidence: ConfidenceScore,
  ) {
    this.market = market;
    this.observations = Object.freeze([...observations]);
    this.comparables = Object.freeze([...comparables]);
    this.confidence = confidence;
  }
}
