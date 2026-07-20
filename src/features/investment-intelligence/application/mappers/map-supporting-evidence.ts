import {
  ObservationBuilder,
  type AnyObservation,
} from "@/platform/observations";

import type {
  InvestmentDecision,
} from "../../domain/investment-decision";

import type {
  SupportingEvidence,
} from "../../domain/entities/supporting-evidence";

import {
  INVESTMENT_OBSERVATION_SOURCE,
  createInvestmentObservationSubject,
} from "../types/investment-observation-shared";

import {
  INVESTMENT_OBSERVATION_TYPES,
} from "../types/investment-observation-types";

export function mapSupportingEvidence(
  evidenceItems:
    readonly SupportingEvidence[],
  decision: InvestmentDecision,
  recordedAt: Date,
): readonly AnyObservation[] {
  const subject =
    createInvestmentObservationSubject(
      decision,
    );

  return evidenceItems.map((evidence) =>
    ObservationBuilder.create()
      .withType(
        INVESTMENT_OBSERVATION_TYPES
          .evidence.item,
      )
      .concerning(subject)
      .withLabel(evidence.title)
      .withValue(evidence.description)
      .fromSource(
        INVESTMENT_OBSERVATION_SOURCE,
      )
      .observedAt(recordedAt)
      .recordedAt(recordedAt)
      .withProvenance({
        retrievedAt: recordedAt,
        effectiveAt: recordedAt,
        notes:
          "Mapped from Investment Intelligence supporting evidence.",
      })
      .withMetadata({
        evidenceId: evidence.id,
        evidenceType: evidence.type,
        direction: evidence.direction,
        evidenceSource: evidence.source,
        confidence: evidence.confidence,
      })
      .build(),
  );
}
