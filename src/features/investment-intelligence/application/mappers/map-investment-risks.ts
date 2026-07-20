import {
  ObservationBuilder,
  type AnyObservation,
} from "@/platform/observations";

import type {
  InvestmentDecision,
} from "../../domain/investment-decision";

import type {
  InvestmentRisk,
} from "../../domain/entities/investment-risk";

import {
  INVESTMENT_OBSERVATION_SOURCE,
  createInvestmentObservationSubject,
} from "../types/investment-observation-shared";

import {
  INVESTMENT_OBSERVATION_TYPES,
} from "../types/investment-observation-types";

export function mapInvestmentRisks(
  risks: readonly InvestmentRisk[],
  decision: InvestmentDecision,
  recordedAt: Date,
): readonly AnyObservation[] {
  const subject =
    createInvestmentObservationSubject(
      decision,
    );

  return risks.map((risk) => {
    const metadata = {
      riskId: risk.id,
      severity: risk.severity,
      probability: risk.probability.value,
      ...(risk.estimatedFinancialImpact
        ? {
            estimatedFinancialImpact:
              risk.estimatedFinancialImpact
                .amount,
            financialImpactCurrency:
              risk.estimatedFinancialImpact
                .currency,
          }
        : {}),
      ...(risk.mitigation
        ? { mitigation: risk.mitigation }
        : {}),
    };

    return ObservationBuilder.create()
      .withType(
        INVESTMENT_OBSERVATION_TYPES
          .risk.item,
      )
      .concerning(subject)
      .withLabel(risk.title)
      .withValue(risk.description)
      .fromSource(
        INVESTMENT_OBSERVATION_SOURCE,
      )
      .observedAt(recordedAt)
      .recordedAt(recordedAt)
      .withProvenance({
        retrievedAt: recordedAt,
        effectiveAt: recordedAt,
        notes:
          "Mapped from an Investment Intelligence risk assessment.",
      })
      .withMetadata(metadata)
      .build();
  });
}
