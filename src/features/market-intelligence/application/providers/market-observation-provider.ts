import {
  ObservationCollection,
  type AnyObservation,
  type ObservationProvider,
} from "@/platform/observations";

import type {
  MarketAnalysisReport,
} from "../../domain/entities/market-analysis-report";

import {
  mapComparableAnalysis,
} from "../mappers/map-comparable-analysis";

import {
  mapMarketEvidence,
} from "../mappers/map-market-evidence";

import {
  mapMarketFindings,
} from "../mappers/map-market-findings";

import {
  mapMarketSummary,
} from "../mappers/map-market-summary";

import {
  mapMarketValuation,
} from "../mappers/map-market-valuation";

import {
  MARKET_OBSERVATION_CAPABILITY,
} from "../types/market-observation-types";

export class MarketObservationProvider
implements ObservationProvider<MarketAnalysisReport> {
  public readonly capability =
    MARKET_OBSERVATION_CAPABILITY;

  public build(
    input: MarketAnalysisReport,
  ): ObservationCollection {
    const recordedAt =
      new Date(input.generatedAt);

    const observations: AnyObservation[] = [
      ...mapComparableAnalysis(
        input.analysis,
        recordedAt,
      ),
      ...mapMarketValuation(
        input.valuation,
        input.analysis.subject,
        recordedAt,
      ),
      ...mapMarketFindings(
        input.findings,
        input.analysis.subject,
        input.generatedAt,
        recordedAt,
      ),
      ...mapMarketEvidence(
        input.evidence,
        input.analysis.subject,
        input.generatedAt,
        recordedAt,
      ),
      ...mapMarketSummary(
        input,
        recordedAt,
      ),
    ];

    return ObservationCollection.create(
      observations,
    );
  }
}

export const marketObservationProvider =
  new MarketObservationProvider();
