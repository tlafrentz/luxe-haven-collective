import {
  ObservationBuilder,
  type AnyObservation,
  type ObservationRecord,
} from "@/platform/observations";

import type {
  InvestmentDecision,
} from "../../domain/investment-decision";

import {
  INVESTMENT_OBSERVATION_SOURCE,
  createInvestmentObservationSubject,
} from "../types/investment-observation-shared";

import {
  INVESTMENT_OBSERVATION_TYPES,
} from "../types/investment-observation-types";

export function mapInvestmentSummary(
  decision: InvestmentDecision,
  recordedAt: Date,
): readonly AnyObservation[] {
  const subject =
    createInvestmentObservationSubject(
      decision,
    );

  const summary: ObservationRecord = {
    acquisitionType:
      decision.acquisitionType,
    recommendation:
      decision.recommendation,
    confidence:
      decision.confidence,
    overallScore:
      decision.score.overall.value,
    projectedAnnualRevenue:
      decision.revenueProjection
        .projectedAnnualRevenue.amount,
    netOperatingIncome:
      decision.financialPerformance
        .netOperatingIncome.amount,
    annualCashFlow:
      decision.financialPerformance
        .annualCashFlow.amount,
    primaryOpportunity:
      decision.strategy.primaryOpportunity,
    primaryRisk:
      decision.strategy.primaryRisk,
    riskCount:
      decision.risks.length,
    evidenceCount:
      decision.supportingEvidence.length,
  };

  return [
    ObservationBuilder.create()
      .withType(
        INVESTMENT_OBSERVATION_TYPES
          .summary.executive,
      )
      .concerning(subject)
      .withLabel(
        "Investment decision summary",
      )
      .withValue(summary)
      .fromSource(
        INVESTMENT_OBSERVATION_SOURCE,
      )
      .observedAt(recordedAt)
      .recordedAt(recordedAt)
      .withProvenance({
        retrievedAt: recordedAt,
        effectiveAt: recordedAt,
        notes:
          "Mapped from the complete Investment Intelligence decision.",
      })
      .withMetadata({
        currency:
          decision.revenueProjection
            .projectedAnnualRevenue.currency,
      })
      .build(),
  ];
}
