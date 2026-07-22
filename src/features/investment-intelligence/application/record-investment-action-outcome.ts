import {
  PlatformError,
} from "@/platform/kernel";

import {
  AcquisitionType,
} from "../domain";
import {
  mapInvestmentFindingToOutcome,
} from "./adapters/map-investment-finding-to-outcome";

import type {
  PlatformActionSource,
} from "@/platform/actions";
import type {
  InvestmentOutcomeDisposition,
  InvestmentOutcomeMeasurement,
  InvestmentOutcomeMeasurementPeriod,
  InvestmentOutcomeMeasurementUnit,
  InvestmentActionOutcomeResult,
  RecordInvestmentActionOutcomeCommand,
} from "./types/investment-outcome-types";

export type InvestmentOutcomeErrorCode =
  | "INVESTMENT_OUTCOME_ACTION_NOT_COMPLETED"
  | "INVESTMENT_OUTCOME_ACTION_CANCELLED"
  | "INVESTMENT_OUTCOME_ACTION_NOT_INVESTMENT"
  | "INVESTMENT_OUTCOME_DECISION_LINEAGE_MISSING"
  | "INVESTMENT_OUTCOME_RECOMMENDATION_LINEAGE_MISSING"
  | "INVESTMENT_OUTCOME_PLAN_LINEAGE_MISSING"
  | "INVESTMENT_OUTCOME_RUN_LINEAGE_MISSING"
  | "INVESTMENT_OUTCOME_SUBJECT_LINEAGE_MISSING"
  | "INVESTMENT_OUTCOME_ROUTE_LINEAGE_MISSING"
  | "INVESTMENT_OUTCOME_INTENT_LINEAGE_MISSING"
  | "INVESTMENT_OUTCOME_DUPLICATE_PRIMARY_OUTCOME"
  | "INVESTMENT_OUTCOME_INVALID_MEASUREMENT"
  | "INVESTMENT_OUTCOME_INVALID_SUMMARY"
  | "INVESTMENT_OUTCOME_INVALID_DISPOSITION"
  | "INVESTMENT_OUTCOME_INVALID_CONTEXT"
  | "INVESTMENT_OUTCOME_INVALID_FINDING_SOURCE";

export class InvestmentOutcomeError extends PlatformError {
  public constructor(
    code: InvestmentOutcomeErrorCode,
    message: string,
  ) {
    super(code, message);
  }
}

/** Captures what completed Investment work revealed without mutating the Action. */
export function recordInvestmentActionOutcome(
  command: RecordInvestmentActionOutcomeCommand,
): InvestmentActionOutcomeResult {
  const lineage = validateActionLineage(command);
  const finding = validateFinding(command);
  const measurements =
    normalizeMeasurements(
      command.finding.measurements ?? [],
    );
  const recommendation =
    command.platformAnalysis.recommendations
      .toArray()
      .find(
        ({ id }) =>
          id.value ===
          lineage.recommendationId,
      );

  if (!recommendation) {
    throw outcomeError(
      "INVESTMENT_OUTCOME_RECOMMENDATION_LINEAGE_MISSING",
      "The Investment Action recommendation is absent from the supplied Platform analysis.",
    );
  }

  const outcome =
    mapInvestmentFindingToOutcome(
      command,
      finding,
      measurements,
      recommendation,
      lineage,
    );

  return {
    acquisitionType:
      lineage.acquisitionType,
    actionId: lineage.actionId,
    decisionId: lineage.decisionId,
    recommendationId:
      lineage.recommendationId,
    planId: lineage.planId,
    investmentRunId:
      lineage.investmentRunId,
    subjectId: lineage.subjectId,
    intentKey: lineage.intentKey,
    measurements,
    outcome,
  };
}

function validateActionLineage(
  command: RecordInvestmentActionOutcomeCommand,
) {
  const {
    action,
    decision,
    platformAnalysis,
  } = command;

  if (action.status === "cancelled") {
    throw outcomeError(
      "INVESTMENT_OUTCOME_ACTION_CANCELLED",
      "A cancelled Investment Action cannot produce a primary Outcome.",
    );
  }
  if (action.status !== "completed") {
    throw outcomeError(
      "INVESTMENT_OUTCOME_ACTION_NOT_COMPLETED",
      "Investment Outcome capture requires an already-completed Action.",
    );
  }
  if (
    !action.actionType?.startsWith(
      "investment.",
    )
  ) {
    throw outcomeError(
      "INVESTMENT_OUTCOME_ACTION_NOT_INVESTMENT",
      "The completed Action was not produced by Investment execution planning.",
    );
  }
  if (
    action.outcomeReferences.some(
      ({ linkType }) =>
        linkType === "result",
    )
  ) {
    throw outcomeError(
      "INVESTMENT_OUTCOME_DUPLICATE_PRIMARY_OUTCOME",
      "The Investment Action already references a primary result Outcome.",
    );
  }

  const decisionId = requiredSourceId(
    action.sources,
    "decision",
    "investment-intelligence",
    "INVESTMENT_OUTCOME_DECISION_LINEAGE_MISSING",
    "Investment Action Decision lineage is missing or ambiguous.",
  );
  const recommendationId = requiredSourceId(
    action.sources,
    "recommendation",
    "investment-intelligence",
    "INVESTMENT_OUTCOME_RECOMMENDATION_LINEAGE_MISSING",
    "Investment Action Recommendation lineage is missing or ambiguous.",
  );
  const planId = requiredSourceId(
    action.sources,
    "automation",
    "investment-execution-plan",
    "INVESTMENT_OUTCOME_PLAN_LINEAGE_MISSING",
    "Investment execution-plan lineage is missing or ambiguous.",
  );
  const investmentRunId = requiredSourceId(
    action.sources,
    "api",
    "investment-platform-run",
    "INVESTMENT_OUTCOME_RUN_LINEAGE_MISSING",
    "Investment Platform-run lineage is missing or ambiguous.",
  );
  const subjectSource = requiredSource(
    action.sources,
    "manual",
    ({ capability }) =>
      capability?.startsWith(
        "investment-subject:",
      ) === true,
    "INVESTMENT_OUTCOME_SUBJECT_LINEAGE_MISSING",
    "Investment subject lineage is missing or ambiguous.",
  );
  const subjectId = subjectSource.sourceId;
  if (!subjectId) {
    throw outcomeError(
      "INVESTMENT_OUTCOME_SUBJECT_LINEAGE_MISSING",
      "Investment subject lineage requires a subject ID.",
    );
  }
  const routeValue =
    subjectSource.capability?.slice(
      "investment-subject:".length,
    );
  const acquisitionType =
    parseAcquisitionType(routeValue);
  const intentKey = requiredSourceId(
    action.sources,
    "automation",
    "investment-execution-intent",
    "INVESTMENT_OUTCOME_INTENT_LINEAGE_MISSING",
    "Investment execution-intent lineage is missing or ambiguous.",
  );

  if (
    decisionId !== decision.id.value ||
    decision.type !==
      "investment.acquisition"
  ) {
    throw outcomeError(
      "INVESTMENT_OUTCOME_DECISION_LINEAGE_MISSING",
      "The Action Decision lineage does not match the supplied Decision.",
    );
  }
  if (
    decision.recommendationIds.length !== 1 ||
    decision.recommendationIds[0].value !==
      recommendationId ||
    decision.metadata.recommendationId !==
      recommendationId
  ) {
    throw outcomeError(
      "INVESTMENT_OUTCOME_RECOMMENDATION_LINEAGE_MISSING",
      "The Action Recommendation lineage does not match the supplied Decision.",
    );
  }
  if (
    decision.context.subjectId !== subjectId ||
    decision.metadata.propertyId !== subjectId
  ) {
    throw outcomeError(
      "INVESTMENT_OUTCOME_SUBJECT_LINEAGE_MISSING",
      "The Action subject does not match the supplied Decision.",
    );
  }
  if (
    decision.context.scope !==
      acquisitionType ||
    decision.metadata.acquisitionType !==
      acquisitionType ||
    platformAnalysis.acquisitionType !==
      acquisitionType
  ) {
    throw outcomeError(
      "INVESTMENT_OUTCOME_ROUTE_LINEAGE_MISSING",
      "Investment Action, Decision, and Platform analysis routes must match.",
    );
  }
  if (
    decision.metadata.platformRunId !==
      investmentRunId ||
    platformAnalysis.lineage.runId !==
      investmentRunId
  ) {
    throw outcomeError(
      "INVESTMENT_OUTCOME_RUN_LINEAGE_MISSING",
      "Investment Action, Decision, and Platform run lineage must match.",
    );
  }

  const recommendations =
    platformAnalysis.recommendations
      .toArray()
      .filter(
        ({ id }) =>
          id.value === recommendationId,
      );
  if (
    recommendations.length !== 1 ||
    recommendations[0].category !==
      "investment-acquisition" ||
    recommendations[0].metadata.propertyId !==
      subjectId ||
    recommendations[0].metadata.runId !==
      investmentRunId ||
    recommendations[0].metadata.acquisitionType !==
      acquisitionType
  ) {
    throw outcomeError(
      "INVESTMENT_OUTCOME_RECOMMENDATION_LINEAGE_MISSING",
      "The Investment recommendation lineage is incomplete or mismatched.",
    );
  }

  return {
    acquisitionType,
    actionId: action.id.value,
    decisionId,
    recommendationId,
    planId,
    investmentRunId,
    subjectId,
    intentKey,
  } as const;
}

function validateFinding(
  command: RecordInvestmentActionOutcomeCommand,
) {
  const summary =
    command.finding.summary.trim();
  if (!summary) {
    throw outcomeError(
      "INVESTMENT_OUTCOME_INVALID_SUMMARY",
      "Investment Outcome summary cannot be empty.",
    );
  }
  if (
    !isDisposition(
      command.finding.disposition,
    )
  ) {
    throw outcomeError(
      "INVESTMENT_OUTCOME_INVALID_DISPOSITION",
      "Investment Outcome disposition is unsupported.",
    );
  }
  if (
    !command.actor.id.trim() ||
    !command.context.outcomeId.trim() ||
    !(command.context.recordedAt instanceof Date) ||
    Number.isNaN(
      command.context.recordedAt.getTime(),
    )
  ) {
    throw outcomeError(
      "INVESTMENT_OUTCOME_INVALID_CONTEXT",
      "Investment Outcome capture requires stable actor, identity, and timestamp values.",
    );
  }
  const completedAt =
    command.action.scheduleValue.completed;
  if (
    completedAt &&
    command.context.recordedAt < completedAt
  ) {
    throw outcomeError(
      "INVESTMENT_OUTCOME_INVALID_CONTEXT",
      "Investment Outcome cannot be recorded before Action completion.",
    );
  }
  if (
    command.finding.source &&
    ![
      "document",
      "inspection",
      "quote",
      "regulatory-review",
      "contract-review",
      "operator-observation",
      "external-provider",
    ].includes(command.finding.source.kind)
  ) {
    throw outcomeError(
      "INVESTMENT_OUTCOME_INVALID_FINDING_SOURCE",
      "Investment Outcome finding source is unsupported.",
    );
  }

  const {
    details,
    ...findingWithoutDetails
  } = command.finding;

  return {
    ...findingWithoutDetails,
    summary,
    ...(details?.trim()
      ? { details: details.trim() }
      : {}),
  };
}

function normalizeMeasurements(
  values:
    readonly InvestmentOutcomeMeasurement[],
): readonly InvestmentOutcomeMeasurement[] {
  const keys = new Set<string>();

  return values.map((measurement) => {
    const key = measurement.key.trim();
    const label = measurement.label.trim();
    if (
      !key ||
      !label ||
      keys.has(key) ||
      !Number.isFinite(measurement.value) ||
      !isMeasurementUnit(measurement.unit) ||
      (measurement.period !== undefined &&
        !isMeasurementPeriod(
          measurement.period,
        )) ||
      (measurement.assumedValue !== undefined &&
        !Number.isFinite(
          measurement.assumedValue,
        )) ||
      (measurement.variance !== undefined &&
        measurement.assumedValue === undefined)
    ) {
      throw outcomeError(
        "INVESTMENT_OUTCOME_INVALID_MEASUREMENT",
        "Investment Outcome measurements require unique keys and valid numeric values, units, and periods.",
      );
    }
    keys.add(key);
    const variance =
      measurement.assumedValue === undefined
        ? undefined
        : measurement.value -
          measurement.assumedValue;

    return {
      key,
      label,
      value: measurement.value,
      unit: measurement.unit,
      ...(measurement.period
        ? { period: measurement.period }
        : {}),
      ...(measurement.assumedValue !== undefined
        ? {
            assumedValue:
              measurement.assumedValue,
            variance,
          }
        : {}),
    };
  });
}

function requiredSourceId(
  sources: readonly PlatformActionSource[],
  type: PlatformActionSource["type"],
  capability: string,
  code: InvestmentOutcomeErrorCode,
  message: string,
): string {
  const source = requiredSource(
    sources,
    type,
    (value) =>
      value.capability === capability,
    code,
    message,
  );
  if (!source.sourceId) {
    throw outcomeError(code, message);
  }
  return source.sourceId;
}

function requiredSource(
  sources: readonly PlatformActionSource[],
  type: PlatformActionSource["type"],
  predicate: (
    value: PlatformActionSource,
  ) => boolean,
  code: InvestmentOutcomeErrorCode,
  message: string,
): PlatformActionSource {
  const matches = sources.filter(
    (value) =>
      value.type === type && predicate(value),
  );
  if (matches.length !== 1) {
    throw outcomeError(code, message);
  }
  return matches[0];
}

function parseAcquisitionType(
  value: string | undefined,
): AcquisitionType {
  if (value === AcquisitionType.Purchase) {
    return AcquisitionType.Purchase;
  }
  if (
    value ===
    AcquisitionType.RentalArbitrage
  ) {
    return AcquisitionType.RentalArbitrage;
  }
  throw outcomeError(
    "INVESTMENT_OUTCOME_ROUTE_LINEAGE_MISSING",
    "Investment Action acquisition-route lineage is missing or unsupported.",
  );
}

function isDisposition(
  value: string,
): value is InvestmentOutcomeDisposition {
  return [
    "favorable",
    "unfavorable",
    "neutral",
    "inconclusive",
  ].includes(value);
}

function isMeasurementUnit(
  value: string,
): value is InvestmentOutcomeMeasurementUnit {
  return [
    "USD",
    "percent",
    "days",
    "months",
    "count",
    "ratio",
  ].includes(value);
}

function isMeasurementPeriod(
  value: string,
): value is InvestmentOutcomeMeasurementPeriod {
  return [
    "monthly",
    "annual",
    "one-time",
  ].includes(value);
}

function outcomeError(
  code: InvestmentOutcomeErrorCode,
  message: string,
): InvestmentOutcomeError {
  return new InvestmentOutcomeError(
    code,
    message,
  );
}
