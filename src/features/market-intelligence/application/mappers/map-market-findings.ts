import {
  ObservationBuilder,
  type AnyObservation,
} from "@/platform/observations";

import type {
  ComparableSubject,
} from "../../domain/entities/comparable-subject";

import type {
  MarketAnalysisFinding,
  MarketAnalysisFindingType,
} from "../../domain/value-objects/market-analysis-finding";

import {
  MARKET_OBSERVATION_SOURCE,
  createMarketObservationSubject,
} from "../types/market-observation-shared";

import {
  MARKET_OBSERVATION_TYPES,
} from "../types/market-observation-types";

export function mapMarketFindings(
  findings:
    readonly MarketAnalysisFinding[],
  subjectInput: ComparableSubject,
  observedAt: Date,
  recordedAt: Date,
): readonly AnyObservation[] {
  const subject =
    createMarketObservationSubject(
      subjectInput,
    );

  return findings.map(
    (finding) =>
      ObservationBuilder.create()
        .withType(
          mapFindingType(finding.type),
        )
        .concerning(subject)
        .withLabel(finding.title)
        .withValue(finding.description)
        .fromSource(
          MARKET_OBSERVATION_SOURCE,
        )
        .observedAt(observedAt)
        .recordedAt(recordedAt)
        .withProvenance({
          retrievedAt: recordedAt,
          effectiveAt: observedAt,
          notes:
            "Mapped from a Market Intelligence analysis finding.",
        })
        .withMetadata({
          findingType: finding.type,
          severity: finding.severity,
          title: finding.title,
        })
        .build(),
  );
}

function mapFindingType(
  type: MarketAnalysisFindingType,
): string {
  switch (type) {
    case "strength":
      return MARKET_OBSERVATION_TYPES
        .findingStrength;
    case "risk":
      return MARKET_OBSERVATION_TYPES
        .findingRisk;
    case "observation":
      return MARKET_OBSERVATION_TYPES
        .findingObservation;
    case "data-gap":
      return MARKET_OBSERVATION_TYPES
        .findingDataGap;
  }
}
