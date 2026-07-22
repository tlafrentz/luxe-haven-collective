import {
  ObservationBuilder,
  ObservationCollection,
  createObservationId,
  type AnyObservation,
  type ObservationProvider,
  type ObservationUnitInput,
  type ObservationValue,
} from "@/platform/observations";

import {
  AcquisitionType,
} from "../../domain";

import type {
  InvestmentLifecycleResult,
} from "../../domain";

import {
  createInvestmentPlatformRunContext,
  normalizeInvestmentPlatformRunContext,
} from "../adapters/investment-platform-run-context";

import type {
  InvestmentPlatformRunContext,
} from "../adapters/investment-platform-run-context";

import {
  normalizeInvestmentUpstream,
} from "../adapters/investment-upstream-adapter";

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
  INVESTMENT_CURRENCY_UNIT,
  INVESTMENT_PERCENTAGE_UNIT,
  INVESTMENT_RATIO_UNIT,
  INVESTMENT_SCORE_UNIT,
} from "../types/investment-observation-shared";

import {
  INVESTMENT_OBSERVATION_CAPABILITY,
  INVESTMENT_OBSERVATION_TYPES,
} from "../types/investment-observation-types";

/** Canonical observation adapter for both Investment acquisition routes. */
export class InvestmentObservationProvider
implements ObservationProvider<InvestmentLifecycleResult> {
  public readonly capability =
    INVESTMENT_OBSERVATION_CAPABILITY;

  public build(
    result: InvestmentLifecycleResult,
    runContext:
      InvestmentPlatformRunContext =
      createInvestmentPlatformRunContext(),
  ): ObservationCollection {
    const context =
      normalizeInvestmentPlatformRunContext(
        runContext,
      );
    const observations =
      result.acquisitionType ===
      AcquisitionType.Purchase
        ? this.buildPurchase(
            result,
            context.recordedAt,
          )
        : this.buildRental(
            result,
            context.observedAt,
            context.recordedAt,
          );
    const upstream =
      normalizeInvestmentUpstream(
        context.upstream ?? {},
      );
    const upstreamObservationIds = [
      ...upstream.marketObservationIds,
      ...upstream.revenueObservationIds,
    ];

    return ObservationCollection.create(
      observations.map(
        (observation, index) =>
          ObservationBuilder.from(
            observation,
          )
            .withId(
              createObservationId(
                `${context.runId}-observation-${index + 1}`,
              ),
            )
            .observedAt(
              context.observedAt,
            )
            .recordedAt(
              context.recordedAt,
            )
            .withMetadata({
              ...observation.metadata,
              runId: context.runId,
              ...(upstreamObservationIds.length >
              0
                ? {
                    upstreamObservationIds,
                  }
                : {}),
            })
            .build(),
      ),
    );
  }

  private buildPurchase(
    result: Extract<
      InvestmentLifecycleResult,
      {
        acquisitionType:
          AcquisitionType.Purchase;
      }
    >,
    recordedAt: Date,
  ): readonly AnyObservation[] {
    const input = result.analysis;

    return [
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
      this.observation(
        result,
        recordedAt,
        recordedAt,
        INVESTMENT_OBSERVATION_TYPES.acquisition
          .type,
        "Acquisition type",
        input.acquisitionType,
      ),
      this.observation(
        result,
        recordedAt,
        recordedAt,
        INVESTMENT_OBSERVATION_TYPES.property
          .purchasePrice,
        "Purchase price",
        input.property.purchasePrice.amount,
        INVESTMENT_CURRENCY_UNIT,
      ),
      this.observation(
        result,
        recordedAt,
        recordedAt,
        INVESTMENT_OBSERVATION_TYPES.financing
          .downPaymentPercentage,
        "Down payment percentage",
        input.assumptions.downPayment.value,
        INVESTMENT_PERCENTAGE_UNIT,
      ),
      this.observation(
        result,
        recordedAt,
        recordedAt,
        INVESTMENT_OBSERVATION_TYPES.market
          .comparablePosition,
        "Comparable position score",
        input.comparableAnalysis
          .marketPositionScore.value,
        INVESTMENT_SCORE_UNIT,
      ),
      this.observation(
        result,
        recordedAt,
        recordedAt,
        INVESTMENT_OBSERVATION_TYPES.market
          .comparableConfidence,
        "Comparable confidence",
        input.comparableAnalysis.confidence,
      ),
    ];
  }

  private buildRental(
    result: Extract<
      InvestmentLifecycleResult,
      {
        acquisitionType:
          AcquisitionType.RentalArbitrage;
      }
    >,
    observedAt: Date,
    recordedAt: Date,
  ): readonly AnyObservation[] {
    const { analysis, derivedAnalysis } =
      result;
    const values: readonly [
      string,
      string,
      ObservationValue,
      ObservationUnitInput?,
    ][] = [
      [INVESTMENT_OBSERVATION_TYPES.acquisition.type, "Acquisition type", analysis.acquisitionType],
      [INVESTMENT_OBSERVATION_TYPES.revenue.projectedAdr, "Projected average daily rate", analysis.revenueProjection.projectedAdr.amount, INVESTMENT_CURRENCY_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.revenue.projectedOccupancy, "Projected occupancy", analysis.revenueProjection.projectedOccupancy.value, INVESTMENT_PERCENTAGE_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.revenue.projectedAnnualRevenue, "Projected annual revenue", analysis.revenueProjection.projectedAnnualRevenue.amount, INVESTMENT_CURRENCY_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.market.comparablePosition, "Comparable position score", analysis.comparableAnalysis.marketPositionScore.value, INVESTMENT_SCORE_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.market.comparableConfidence, "Comparable confidence", analysis.comparableAnalysis.confidence],
      [INVESTMENT_OBSERVATION_TYPES.expenses.totalOperatingExpenses, "Annual operating expenses", analysis.expenseProjection.totalOperatingExpenses.amount, INVESTMENT_CURRENCY_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.financial.annualCashFlow, "Annual cash flow", analysis.financialPerformance.annualCashFlow.amount, INVESTMENT_CURRENCY_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.financial.breakEvenOccupancy, "Break-even occupancy", analysis.financialPerformance.breakEvenOccupancy.value, INVESTMENT_PERCENTAGE_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.financial.cashOnCashReturn, "Cash-on-cash return", analysis.financialPerformance.cashOnCashReturn.value, INVESTMENT_PERCENTAGE_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.financial.leaseCoverageRatio, "Lease coverage ratio", analysis.financialPerformance.leaseCoverageRatio, INVESTMENT_RATIO_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.rentalArbitrage.monthlyLease, "Monthly lease", analysis.assumptions.monthlyLease.amount, INVESTMENT_CURRENCY_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.rentalArbitrage.securityDeposit, "Security deposit", analysis.assumptions.securityDeposit.amount, INVESTMENT_CURRENCY_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.property.furnishingBudget, "Furnishing budget", analysis.assumptions.furnishingBudget.amount, INVESTMENT_CURRENCY_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.rentalArbitrage.startupCosts, "Startup costs", analysis.assumptions.startupCosts.amount, INVESTMENT_CURRENCY_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.rentalArbitrage.startupCapital, "Furnishing and setup capital", analysis.financialPerformance.initialCashInvested.amount, INVESTMENT_CURRENCY_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.rentalArbitrage.annualLeaseExpense, "Annual lease expense", analysis.financialPerformance.annualLeaseExpense.amount, INVESTMENT_CURRENCY_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.rentalArbitrage.monthlyOperatingMargin, "Monthly operating margin", analysis.financialPerformance.monthlyOperatingMargin.amount, INVESTMENT_CURRENCY_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.rentalArbitrage.utilitiesIncluded, "Utilities included in lease", analysis.assumptions.utilitiesIncluded],
      [INVESTMENT_OBSERVATION_TYPES.rentalArbitrage.failurePointStatus, "Rental failure-point status", derivedAnalysis.failurePoints.status],
      [INVESTMENT_OBSERVATION_TYPES.rentalArbitrage.maximumMonthlyLease, "Maximum sustainable monthly lease", derivedAnalysis.failurePoints.maximumMonthlyLease.amount, INVESTMENT_CURRENCY_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.rentalArbitrage.minimumOccupancy, "Minimum sustainable occupancy", derivedAnalysis.failurePoints.minimumOccupancy.value, INVESTMENT_PERCENTAGE_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.rentalArbitrage.stressOutcome, "Market stress-test outcome", derivedAnalysis.stressTests.overallOutcome],
      [INVESTMENT_OBSERVATION_TYPES.rentalArbitrage.failedStressCount, "Failed market stress tests", derivedAnalysis.stressTests.failedStressCount],
      [INVESTMENT_OBSERVATION_TYPES.score.overall, "Overall investment score", analysis.score.overall.value, INVESTMENT_SCORE_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.score.revenuePotential, "Revenue potential score", analysis.score.revenuePotential.value, INVESTMENT_SCORE_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.score.financialStrength, "Financial strength score", analysis.score.financialStrength.value, INVESTMENT_SCORE_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.score.marketStrength, "Market strength score", analysis.score.marketStrength.value, INVESTMENT_SCORE_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.score.competitivePosition, "Competitive position score", analysis.score.competitivePosition.value, INVESTMENT_SCORE_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.score.riskExposure, "Risk exposure score", analysis.score.riskExposure.value, INVESTMENT_SCORE_UNIT],
      [INVESTMENT_OBSERVATION_TYPES.decision.recommendation, "Acquisition recommendation", analysis.recommendation],
      [INVESTMENT_OBSERVATION_TYPES.decision.confidence, "Decision confidence", analysis.confidence],
    ];

    return [
      ...values.map(
        ([type, label, value, unit]) =>
          this.observation(
            result,
            observedAt,
            recordedAt,
            type,
            label,
            value,
            unit,
          ),
      ),
      ...analysis.risks.map((risk) =>
        this.observation(
          result,
          observedAt,
          recordedAt,
          INVESTMENT_OBSERVATION_TYPES.risk.item,
          risk.title,
          risk.description,
        ),
      ),
      ...analysis.supportingEvidence.map(
        (evidence) =>
          this.observation(
            result,
            observedAt,
            recordedAt,
            INVESTMENT_OBSERVATION_TYPES.evidence.item,
            evidence.title,
            evidence.description,
          ),
      ),
    ];
  }

  private observation(
    result: InvestmentLifecycleResult,
    observedAt: Date,
    recordedAt: Date,
    type: string,
    label: string,
    value: ObservationValue,
    unit?: ObservationUnitInput,
  ): AnyObservation {
    const builder = ObservationBuilder.create()
      .withType(type)
      .concerning({
        type: "property",
        id: result.analysis.property.id,
      })
      .withLabel(label)
      .withValue(value)
      .fromSource({
        type: "feature",
        name: this.capability,
      })
      .observedAt(observedAt)
      .recordedAt(recordedAt)
      .withProvenance({
        retrievedAt: recordedAt,
        effectiveAt: observedAt,
        notes:
          "Mapped from the canonical Investment lifecycle result.",
      });

    return unit
      ? builder.measuredIn(unit).build()
      : builder.build();
  }
}

export const investmentObservationProvider =
  new InvestmentObservationProvider();
