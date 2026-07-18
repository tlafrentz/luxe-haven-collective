import { ComparableProperty } from "../../domain/entities/comparable-property";
import { MarketIntelligenceReport } from "../../domain/entities/market-intelligence-report";
import { MarketObservation } from "../../domain/entities/market-observation";
import { MarketProfile } from "../../domain/entities/market-profile";

import { mergeProviderResults } from "./merge-provider-results";
import { scoreConfidence } from "./score-confidence";

export interface BuildMarketIntelligenceInput {
  readonly market: MarketProfile;

  readonly observations: readonly MarketObservation[];

  readonly comparables: readonly ComparableProperty[];
}

export function buildMarketIntelligence(
  input: BuildMarketIntelligenceInput,
): MarketIntelligenceReport {
  const mergedObservations =
    mergeProviderResults(
      input.observations,
    );

  const confidence =
    scoreConfidence(
      mergedObservations,
    );

  return new MarketIntelligenceReport(
    input.market,
    mergedObservations,
    input.comparables,
    confidence,
  );
}
