import {
  Identifier,
} from "@/platform/kernel";
import {
  Outcome,
  createOutcomeId,
  emptyOutcomeLineage,
} from "@/platform/outcomes";

import type {
  Recommendation,
} from "@/platform/recommendations";
import type {
  AcquisitionType,
} from "../../domain";
import type {
  InvestmentOutcomeFinding,
  InvestmentOutcomeMeasurement,
  RecordInvestmentActionOutcomeCommand,
} from "../types";

export type InvestmentOutcomeLineage =
  Readonly<{
    acquisitionType: AcquisitionType;
    actionId: string;
    decisionId: string;
    recommendationId: string;
    planId: string;
    investmentRunId: string;
    subjectId: string;
    intentKey: string;
  }>;

/** The sole Investment adapter that translates an explicit finding into an Outcome. */
export function mapInvestmentFindingToOutcome(
  command:
    RecordInvestmentActionOutcomeCommand,
  finding: InvestmentOutcomeFinding,
  measurements:
    readonly InvestmentOutcomeMeasurement[],
  recommendation: Recommendation,
  lineage: InvestmentOutcomeLineage,
): Outcome {
  const completedAt =
    command.action.scheduleValue.completed;
  if (!completedAt) {
    throw new TypeError(
      "Completed Investment Action must have a completion timestamp.",
    );
  }

  const startedAt =
    command.action.history.find(
      ({ operation }) =>
        operation === "started",
    )?.occurredAt ?? command.action.createdAt;
  const metricValues:
    Record<string, number> = {};
  const measurementResults:
    Record<
      string,
      Readonly<
        Record<
          string,
          string | number | boolean | null
        >
      >
    > = {};

  for (const measurement of measurements) {
    metricValues[measurement.key] =
      measurement.value;
    if (
      measurement.assumedValue !== undefined
    ) {
      metricValues[
        `${measurement.key}.assumed`
      ] = measurement.assumedValue;
      metricValues[
        `${measurement.key}.variance`
      ] = measurement.variance ?? 0;
    }
    measurementResults[
      `measurement:${measurement.key}`
    ] = {
      label: measurement.label,
      value: measurement.value,
      unit: measurement.unit,
      period: measurement.period ?? null,
      assumedValue:
        measurement.assumedValue ?? null,
      variance:
        measurement.variance ?? null,
    };
  }

  const baseLineage = emptyOutcomeLineage();

  return Outcome.create({
    id: createOutcomeId(
      command.context.outcomeId,
    ),
    title:
      `Investment finding: ${command.action.title}`,
    summary: finding.summary,
    type: "investment-action-finding",
    status: "completed",
    successful: true,
    startedAt,
    completedAt,
    metrics: metricValues,
    result: {
      disposition: finding.disposition,
      details: finding.details ?? null,
      sourceKind:
        finding.source?.kind ?? null,
      sourceReference:
        finding.source?.reference ?? null,
      assumptionReferences:
        finding.assumptionReferences ?? [],
      evidenceReferences:
        finding.evidenceReferences ?? [],
      ...measurementResults,
    },
    notes: finding.details
      ? [finding.details]
      : [],
    lineage: {
      ...baseLineage,
      actionIds: [
        Identifier.create(lineage.actionId),
      ],
      decisionIds: [
        Identifier.create(lineage.decisionId),
      ],
      recommendationIds: [
        Identifier.create(
          lineage.recommendationId,
        ),
      ],
      evaluationIds:
        recommendation.evaluationIds,
      claimIds: recommendation.claimIds,
      evidenceIds:
        recommendation.evidenceIds,
      observationIds:
        recommendation.observationIds,
    },
    metadata: {
      capability:
        "investment-intelligence",
      acquisitionType:
        lineage.acquisitionType,
      actionId: lineage.actionId,
      decisionId: lineage.decisionId,
      recommendationId:
        lineage.recommendationId,
      executionPlanId: lineage.planId,
      investmentRunId:
        lineage.investmentRunId,
      propertyId: lineage.subjectId,
      intentKey: lineage.intentKey,
      disposition: finding.disposition,
      recordedByActorId:
        command.actor.id,
      ...(command.actor.displayName?.trim()
        ? {
            recordedByActorDisplayName:
              command.actor.displayName.trim(),
          }
        : {}),
      recordedAt:
        command.context.recordedAt.toISOString(),
    },
  });
}
