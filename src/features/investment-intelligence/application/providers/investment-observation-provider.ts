import {
  ObservationCollection,
  type AnyObservation,
  type ObservationProvider,
} from "@/platform/observations";

import type {
  InvestmentDecision,
} from "../../domain/investment-decision";

import {
  mapAcquisitionStrategy,
  mapExpenseProjection,
  mapFinancialPerformance,
  mapInvestmentDecision,
  mapInvestmentRisks,
  mapInvestmentScore,
  mapInvestmentSummary,
  mapRevenueProjection,
  mapSupportingEvidence,
} from "../mappers";

import {
  INVESTMENT_OBSERVATION_CAPABILITY,
} from "../types/investment-observation-types";

type Clock = () => Date;

/**
 * Canonical platform adapter for Investment Intelligence.
 *
 * PF-003.5D Batch 4 completes Investment Observation Mapping with
 * risks, supporting evidence, and an executive decision summary.
 */
export class InvestmentObservationProvider
implements ObservationProvider<InvestmentDecision> {
  public readonly capability =
    INVESTMENT_OBSERVATION_CAPABILITY;

  public constructor(
    private readonly clock: Clock =
      () => new Date(),
  ) {}

  public build(
    input: InvestmentDecision,
  ): ObservationCollection {
    const recordedAt =
      copyValidDate(this.clock());

    const observations: AnyObservation[] = [
      ...mapRevenueProjection(
        input.revenueProjection,
        input,
        recordedAt,
      ),
      ...mapExpenseProjection(
        input.expenseProjection,
        input,
        recordedAt,
      ),
      ...mapFinancialPerformance(
        input.financialPerformance,
        input,
        recordedAt,
      ),
      ...mapInvestmentScore(
        input.score,
        input,
        recordedAt,
      ),
      ...mapInvestmentDecision(
        input,
        recordedAt,
      ),
      ...mapAcquisitionStrategy(
        input.strategy,
        input,
        recordedAt,
      ),
      ...mapInvestmentRisks(
        input.risks,
        input,
        recordedAt,
      ),
      ...mapSupportingEvidence(
        input.supportingEvidence,
        input,
        recordedAt,
      ),
      ...mapInvestmentSummary(
        input,
        recordedAt,
      ),
    ];

    return ObservationCollection.create(
      observations,
    );
  }
}

export const investmentObservationProvider =
  new InvestmentObservationProvider();

function copyValidDate(
  value: Date,
): Date {
  if (
    !(value instanceof Date) ||
    Number.isNaN(value.getTime())
  ) {
    throw new TypeError(
      "Investment observation clock must return a valid date.",
    );
  }

  return new Date(value);
}
