import {
  PlatformError,
} from "@/platform/kernel";

import type {
  AppliedLearningReference,
  BuildInvestmentAppliedLearningContextCommand,
  InvestmentAppliedLearningContext,
  InvestmentAssumptionOverride,
  InvestmentConstraint,
  InvestmentLearningApplication,
  InvestmentLearningApplicationTarget,
  InvestmentRiskContext,
} from "./types/investment-learning-application-types";

export type InvestmentAppliedLearningContextErrorCode =
  | "INVESTMENT_APPLIED_LEARNING_INVALID_COMMAND"
  | "INVESTMENT_APPLIED_LEARNING_DUPLICATE_APPLICATION"
  | "INVESTMENT_APPLIED_LEARNING_INVALID_APPLICATION"
  | "INVESTMENT_APPLIED_LEARNING_EFFECTIVE_DATE_MISSING"
  | "INVESTMENT_APPLIED_LEARNING_LINEAGE_MISSING"
  | "INVESTMENT_APPLIED_LEARNING_SCOPE_INVALID"
  | "INVESTMENT_APPLIED_LEARNING_CONFLICT";

export class InvestmentAppliedLearningContextError extends PlatformError {
  public constructor(
    code: InvestmentAppliedLearningContextErrorCode,
    message: string,
  ) {
    super(code, message);
  }
}

type Projection = Readonly<{
  category: "override" | "constraint" | "data-gap" | "risk";
  key: string;
  application: InvestmentLearningApplication;
  value:
    | InvestmentAssumptionOverride
    | InvestmentConstraint
    | InvestmentRiskContext
    | string;
}>;

/** Builds the sole deterministic projection of approved Learning eligible for a future Investment run. */
export function buildInvestmentAppliedLearningContext(
  command: BuildInvestmentAppliedLearningContextCommand,
): InvestmentAppliedLearningContext {
  validateCommand(command);
  validateApplications(command.applications);

  const supersededIds = new Set(
    command.applications
      .map(({ supersedesApplicationId }) => supersedesApplicationId?.trim())
      .filter((id): id is string => Boolean(id)),
  );
  const eligible = command.applications.filter((application) =>
    isEligible(application, command, supersededIds),
  );
  const projected = eligible.flatMap(projectApplication);
  const resolved = resolveConflicts(projected);
  const appliedApplications = uniqueApplications(resolved.map(({ application }) => application));

  return deepFreeze({
    applicationIds: appliedApplications.map(({ id }) => id),
    assumptionOverrides: resolved
      .filter((item): item is Projection & { value: InvestmentAssumptionOverride } => item.category === "override")
      .map(({ value }) => value)
      .sort(byKey("assumptionKey")),
    constraints: resolved
      .filter((item): item is Projection & { value: InvestmentConstraint } => item.category === "constraint")
      .map(({ value }) => value)
      .sort(byKey("key")),
    resolvedDataGaps: resolved
      .filter((item): item is Projection & { value: string } => item.category === "data-gap")
      .map(({ value }) => value)
      .sort((first, second) => first.localeCompare(second)),
    persistentRisks: resolved
      .filter((item): item is Projection & { value: InvestmentRiskContext } => item.category === "risk")
      .map(({ value }) => value)
      .sort(byKey("key")),
    lineage: appliedApplications.map(toReference).sort(byKey("applicationId")),
  });
}

function validateCommand(command: BuildInvestmentAppliedLearningContextCommand): void {
  if (!command.subjectId.trim()) {
    fail("INVESTMENT_APPLIED_LEARNING_INVALID_COMMAND", "Applied Learning subject ID cannot be empty.");
  }
  if (!(command.analysisDate instanceof Date) || Number.isNaN(command.analysisDate.getTime())) {
    fail("INVESTMENT_APPLIED_LEARNING_INVALID_COMMAND", "Applied Learning analysis date must be valid.");
  }
  if (command.marketId !== undefined && !command.marketId.trim()) {
    fail("INVESTMENT_APPLIED_LEARNING_INVALID_COMMAND", "Applied Learning market ID cannot be empty when supplied.");
  }
}

function validateApplications(applications: readonly InvestmentLearningApplication[]): void {
  const ids = applications.map(({ id }) => id.trim());
  if (ids.some((id) => !id)) {
    fail("INVESTMENT_APPLIED_LEARNING_INVALID_APPLICATION", "Learning Application IDs cannot be empty.");
  }
  if (new Set(ids).size !== ids.length) {
    fail("INVESTMENT_APPLIED_LEARNING_DUPLICATE_APPLICATION", "Learning Application IDs must be unique.");
  }
  for (const application of applications) {
    validDate(application.approvedAt);
    if (!application.effectiveFrom) {
      fail("INVESTMENT_APPLIED_LEARNING_EFFECTIVE_DATE_MISSING", "An approved Learning Application requires an explicit effective date before consumption.");
    }
    validDate(application.effectiveFrom);
    if (application.expiresAt) validDate(application.expiresAt);
    if (
      application.learningInsightIds.length === 0 ||
      application.sourceOutcomeIds.length === 0 ||
      application.sourceInvestmentRunIds.length === 0 ||
      application.sourceSubjectIds.length === 0 ||
      application.sourceAcquisitionTypes.length === 0 ||
      !application.approvalDecisionId.trim()
    ) {
      fail("INVESTMENT_APPLIED_LEARNING_LINEAGE_MISSING", "Learning Application lineage must include Learning, Outcome, run, subject, route, and approval Decision references.");
    }
    validateUniqueLineage(application);
    validateTarget(application.target);
    validateTargetLineage(application);
  }
}

function isEligible(
  application: InvestmentLearningApplication,
  command: BuildInvestmentAppliedLearningContextCommand,
  supersededIds: ReadonlySet<string>,
): boolean {
  if (application.status !== "approved" || supersededIds.has(application.id)) return false;
  if (application.effectiveFrom!.getTime() > command.analysisDate.getTime()) return false;
  if (application.expiresAt && application.expiresAt.getTime() <= command.analysisDate.getTime()) return false;
  if (!application.sourceAcquisitionTypes.includes(command.acquisitionType)) return false;
  switch (application.target.kind) {
    case "subject-assumption": return application.target.subjectId === command.subjectId;
    case "subject-strategy": return application.target.subjectId === command.subjectId && application.target.acquisitionType === command.acquisitionType;
    case "market-assumption-candidate": return Boolean(command.marketId) && application.target.marketId === command.marketId;
    case "execution-policy-candidate": return application.target.acquisitionType === command.acquisitionType;
    case "confidence-calibration-candidate": return application.target.capability === "investment-intelligence";
  }
}

function projectApplication(application: InvestmentLearningApplication): readonly Projection[] {
  const key = targetKey(application.target);
  switch (application.mode) {
    case "replace-assumption":
    case "adjust-assumption": {
      if (!application.appliedValue) {
        fail("INVESTMENT_APPLIED_LEARNING_INVALID_APPLICATION", "Assumption applications require an applied value.");
      }
      return [{
        category: "override",
        key,
        application,
        value: {
          assumptionKey: key,
          operation: application.mode === "replace-assumption" ? "replace" : "adjust",
          ...(application.previousValue ? { previousValue: cloneValue(application.previousValue) } : {}),
          appliedValue: cloneValue(application.appliedValue),
          applicationId: application.id,
          rationale: application.rationale,
        },
      }];
    }
    case "add-constraint": return [{
      category: "constraint",
      key,
      application,
      value: { key, description: application.rationale, applicationId: application.id },
    }];
    case "resolve-data-gap": return [{ category: "data-gap", key, application, value: key }];
    case "add-risk-context": {
      if (!application.riskSeverity) {
        fail("INVESTMENT_APPLIED_LEARNING_INVALID_APPLICATION", "Persistent risk applications require a severity.");
      }
      return [{
        category: "risk",
        key,
        application,
        value: { key, description: application.rationale, severity: application.riskSeverity, applicationId: application.id },
      }];
    }
    case "calibration-candidate":
    case "policy-review-candidate": return [];
  }
}

function resolveConflicts(projections: readonly Projection[]): readonly Projection[] {
  const groups = new Map<string, Projection[]>();
  for (const projection of projections) {
    const groupKey = `${projection.category}:${projection.key}`;
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), projection]);
  }
  return [...groups.values()].map((group) => {
    if (group.length === 1) return group[0];
    const ranked = [...group].sort(comparePrecedence);
    if (comparePrecedence(ranked[0], ranked[1]) === 0) {
      fail("INVESTMENT_APPLIED_LEARNING_CONFLICT", `Learning Applications conflict for ${ranked[0].category} ${ranked[0].key}.`);
    }
    return ranked[0];
  }).sort((first, second) => `${first.category}:${first.key}`.localeCompare(`${second.category}:${second.key}`));
}

function comparePrecedence(first: Projection, second: Projection): number {
  const time = second.application.approvedAt.getTime() - first.application.approvedAt.getTime();
  if (time !== 0) return time;
  return targetSpecificity(second.application.target) - targetSpecificity(first.application.target);
}

function targetSpecificity(target: InvestmentLearningApplicationTarget): number {
  switch (target.kind) {
    case "subject-assumption":
    case "subject-strategy": return 3;
    case "market-assumption-candidate": return 2;
    case "execution-policy-candidate": return 1;
    case "confidence-calibration-candidate": return 0;
  }
}

function targetKey(target: InvestmentLearningApplicationTarget): string {
  switch (target.kind) {
    case "subject-assumption":
    case "market-assumption-candidate": return target.assumptionKey;
    case "subject-strategy": return `strategy:${target.acquisitionType}`;
    case "execution-policy-candidate": return target.policyKey;
    case "confidence-calibration-candidate": return target.dimension;
  }
}

function toReference(application: InvestmentLearningApplication): AppliedLearningReference {
  return {
    applicationId: application.id,
    learningInsightIds: [...application.learningInsightIds].sort(),
    outcomeIds: [...application.sourceOutcomeIds].sort(),
    investmentRunIds: [...application.sourceInvestmentRunIds].sort(),
    approvalDecisionId: application.approvalDecisionId,
  };
}

function uniqueApplications(applications: readonly InvestmentLearningApplication[]): readonly InvestmentLearningApplication[] {
  return [...new Map(applications.map((application) => [application.id, application])).values()]
    .sort((first, second) => first.id.localeCompare(second.id));
}

function validateUniqueLineage(application: InvestmentLearningApplication): void {
  const lists = [application.learningInsightIds, application.sourceOutcomeIds, application.sourceInvestmentRunIds, application.sourceSubjectIds, application.sourceAcquisitionTypes];
  if (lists.some((list) => new Set(list).size !== list.length || list.some((value) => !String(value).trim()))) {
    fail("INVESTMENT_APPLIED_LEARNING_LINEAGE_MISSING", "Learning Application lineage references must be non-empty and unique.");
  }
}

function validateTarget(target: InvestmentLearningApplicationTarget): void {
  const values = target.kind === "subject-assumption" ? [target.subjectId, target.assumptionKey]
    : target.kind === "subject-strategy" ? [target.subjectId, target.acquisitionType]
      : target.kind === "market-assumption-candidate" ? [target.marketId, target.assumptionKey]
        : target.kind === "execution-policy-candidate" ? [target.acquisitionType, target.policyKey]
          : [target.capability, target.dimension];
  if (values.some((value) => !String(value).trim())) {
    fail("INVESTMENT_APPLIED_LEARNING_SCOPE_INVALID", "Learning Application target fields cannot be empty.");
  }
}

function validateTargetLineage(application: InvestmentLearningApplication): void {
  const { target } = application;
  if (
    (target.kind === "subject-assumption" || target.kind === "subject-strategy") &&
    !application.sourceSubjectIds.includes(target.subjectId)
  ) {
    fail("INVESTMENT_APPLIED_LEARNING_SCOPE_INVALID", "Subject application target must exist in its approved source lineage.");
  }
  if (
    (target.kind === "subject-strategy" || target.kind === "execution-policy-candidate") &&
    !application.sourceAcquisitionTypes.includes(target.acquisitionType)
  ) {
    fail("INVESTMENT_APPLIED_LEARNING_SCOPE_INVALID", "Strategy application route must exist in its approved source lineage.");
  }
}

function validDate(value: Date): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    fail("INVESTMENT_APPLIED_LEARNING_INVALID_APPLICATION", "Learning Application dates must be valid.");
  }
}

function cloneValue(value: { value: number | string | boolean; unit?: string }) {
  return { value: value.value, ...(value.unit ? { unit: value.unit } : {}) };
}

function byKey<TKey extends string>(key: TKey) {
  return (first: Record<TKey, string>, second: Record<TKey, string>) => first[key].localeCompare(second[key]);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function fail(code: InvestmentAppliedLearningContextErrorCode, message: string): never {
  throw new InvestmentAppliedLearningContextError(code, message);
}
