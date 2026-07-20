import {
  ObservationBuilder,
  type AnyObservation,
} from "@/platform/observations";

import type {
  MarketAnalysisReport,
} from "../../domain/entities/market-analysis-report";

import {
  MARKET_OBSERVATION_SOURCE,
  createMarketObservationSubject,
} from "../types/market-observation-shared";

import {
  MARKET_OBSERVATION_TYPES,
} from "../types/market-observation-types";

export function mapMarketSummary(
  report: MarketAnalysisReport,
  recordedAt: Date,
): readonly AnyObservation[] {
  const subject =
    createMarketObservationSubject(
      report.analysis.subject,
    );

  return [
    ObservationBuilder.create()
      .withType(
        MARKET_OBSERVATION_TYPES.summary,
      )
      .concerning(subject)
      .withLabel(
        "Market analysis summary",
      )
      .withValue(report.summary)
      .fromSource(MARKET_OBSERVATION_SOURCE)
      .observedAt(report.generatedAt)
      .recordedAt(recordedAt)
      .withProvenance({
        retrievedAt: recordedAt,
        effectiveAt: report.generatedAt,
        notes:
          "Mapped from the Market Intelligence analysis report summary.",
      })
      .withMetadata({
        confidenceScore:
          report.confidenceScore,
        confidenceLevel:
          report.confidenceLevel,
        riskCount: report.riskCount,
        dataGapCount:
          report.dataGapCount,
      })
      .build(),
  ];
}
