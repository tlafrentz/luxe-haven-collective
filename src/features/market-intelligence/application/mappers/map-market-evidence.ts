import {
  ObservationBuilder,
  type AnyObservation,
} from "@/platform/observations";

import type {
  ComparableSubject,
} from "../../domain/entities/comparable-subject";

import type {
  MarketAnalysisEvidence,
  MarketAnalysisEvidenceType,
} from "../../domain/value-objects/market-analysis-evidence";

import {
  MARKET_OBSERVATION_SOURCE,
  createMarketObservationSubject,
} from "../types/market-observation-shared";

import {
  MARKET_OBSERVATION_TYPES,
} from "../types/market-observation-types";

export function mapMarketEvidence(
  evidence:
    readonly MarketAnalysisEvidence[],
  subjectInput: ComparableSubject,
  observedAt: Date,
  recordedAt: Date,
): readonly AnyObservation[] {
  const subject =
    createMarketObservationSubject(
      subjectInput,
    );

  return evidence.map(
    (item) =>
      ObservationBuilder.create()
        .withType(
          mapEvidenceType(item.type),
        )
        .concerning(subject)
        .withLabel(item.label)
        .withValue(item.value)
        .fromSource({
          ...MARKET_OBSERVATION_SOURCE,
          ...(item.source
            ? {
                referenceId:
                  item.source,
              }
            : {}),
        })
        .observedAt(observedAt)
        .recordedAt(recordedAt)
        .withProvenance({
          retrievedAt: recordedAt,
          effectiveAt: observedAt,
          notes:
            "Mapped from Market Intelligence analysis evidence.",
        })
        .withMetadata({
          evidenceType: item.type,
          ...(item.source
            ? {
                evidenceSource:
                  item.source,
              }
            : {}),
        })
        .build(),
  );
}

function mapEvidenceType(
  type: MarketAnalysisEvidenceType,
): string {
  switch (type) {
    case "subject-property":
      return MARKET_OBSERVATION_TYPES
        .evidenceSubjectProperty;
    case "comparable-property":
      return MARKET_OBSERVATION_TYPES
        .evidenceComparableProperty;
    case "valuation":
      return MARKET_OBSERVATION_TYPES
        .evidenceValuation;
    case "provider":
      return MARKET_OBSERVATION_TYPES
        .evidenceProvider;
    case "calculation":
      return MARKET_OBSERVATION_TYPES
        .evidenceCalculation;
  }
}
