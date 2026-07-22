import {
  PlatformError,
} from "@/platform/kernel";

import {
  AcquisitionType,
  RiskSeverity,
} from "../domain";
import {
  mapInvestmentExecutionPlanToActions,
} from "./adapters/map-investment-execution-plan-to-actions";

import type {
  InvestmentDataGap,
  InvestmentLifecycleResult,
  InvestmentPlatformAnalysis,
} from "../domain";
import type {
  InvestmentExecutionIntent,
  InvestmentExecutionPlan,
  PlanInvestmentExecutionCommand,
} from "./types/investment-execution-types";

export type InvestmentExecutionErrorCode =
  | "INVESTMENT_EXECUTION_DECISION_NOT_ACCEPTED"
  | "INVESTMENT_EXECUTION_DECISION_MISMATCH"
  | "INVESTMENT_EXECUTION_DECISION_NOT_EXECUTABLE"
  | "INVESTMENT_EXECUTION_RECOMMENDATION_MISMATCH"
  | "INVESTMENT_EXECUTION_ROUTE_MISMATCH"
  | "INVESTMENT_EXECUTION_SUBJECT_MISMATCH"
  | "INVESTMENT_EXECUTION_RUN_MISMATCH"
  | "INVESTMENT_EXECUTION_INVALID_CONTEXT"
  | "INVESTMENT_EXECUTION_ACTION_ID_MISSING"
  | "INVESTMENT_EXECUTION_DUPLICATE_ACTION_ID"
  | "INVESTMENT_EXECUTION_INVALID_DEPENDENCY";

export class InvestmentExecutionError extends PlatformError {
  public constructor(
    code: InvestmentExecutionErrorCode,
    message: string,
  ) {
    super(code, message);
  }
}

/** Plans executable Investment work after, and only after, operator acceptance. */
export function planInvestmentExecution(
  command: PlanInvestmentExecutionCommand,
): InvestmentExecutionPlan {
  const {
    lifecycleResult,
    platformAnalysis,
    decision,
    context,
  } = command;

  validateAcceptedDecision(command);

  const recommendationId =
    decision.recommendationIds[0].value;
  const subjectId =
    lifecycleResult.analysis.property.id;
  const intents = buildExecutionIntents(
    lifecycleResult,
    platformAnalysis,
  );

  validatePlanningContext(context);
  validateIntents(intents);
  validateActionIds(intents, context.actionIds);

  const actions =
    mapInvestmentExecutionPlanToActions(
      intents,
      {
        acquisitionType:
          lifecycleResult.acquisitionType,
        subjectId,
        decisionId: decision.id.value,
        recommendationId,
        investmentRunId:
          platformAnalysis.lineage.runId,
      },
      command.actor,
      context,
    );

  return {
    id: context.planId,
    acquisitionType:
      lifecycleResult.acquisitionType,
    subjectId,
    decisionId: decision.id.value,
    recommendationId,
    investmentRunId:
      platformAnalysis.lineage.runId,
    plannedAt: new Date(context.plannedAt),
    intents,
    actions,
  };
}

function validateAcceptedDecision(
  command: PlanInvestmentExecutionCommand,
): void {
  const {
    lifecycleResult,
    platformAnalysis,
    decision,
  } = command;

  if (
    decision.outcome !== "accepted"
  ) {
    throw executionError(
      "INVESTMENT_EXECUTION_DECISION_NOT_ACCEPTED",
      "Investment execution requires an accepted Decision.",
    );
  }

  if (
    decision.type !==
      "investment.acquisition" ||
    decision.metadata.capability !==
      "investment-intelligence"
  ) {
    throw executionError(
      "INVESTMENT_EXECUTION_DECISION_MISMATCH",
      "The supplied Decision is not an Investment commitment Decision.",
    );
  }

  if (
    decision.metadata
      .supersededByDecisionId
  ) {
    throw executionError(
      "INVESTMENT_EXECUTION_DECISION_NOT_EXECUTABLE",
      "A superseded Investment Decision cannot be planned.",
    );
  }

  if (
    lifecycleResult.acquisitionType !==
      platformAnalysis.acquisitionType ||
    decision.metadata.acquisitionType !==
      lifecycleResult.acquisitionType ||
    decision.context.scope !==
      lifecycleResult.acquisitionType
  ) {
    throw executionError(
      "INVESTMENT_EXECUTION_ROUTE_MISMATCH",
      "Investment lifecycle, Platform analysis, and Decision routes must match.",
    );
  }

  const subjectId =
    lifecycleResult.analysis.property.id;
  if (
    decision.context.subjectId !==
      subjectId ||
    decision.metadata.propertyId !==
      subjectId
  ) {
    throw executionError(
      "INVESTMENT_EXECUTION_SUBJECT_MISMATCH",
      "The Investment Decision subject does not match the lifecycle subject.",
    );
  }

  if (
    decision.metadata.platformRunId !==
      platformAnalysis.lineage.runId ||
    decision.context.getAttribute(
      "platformRunId",
    ) !== platformAnalysis.lineage.runId
  ) {
    throw executionError(
      "INVESTMENT_EXECUTION_RUN_MISMATCH",
      "The Investment Decision does not belong to the supplied Platform run.",
    );
  }

  if (
    decision.recommendationIds.length !== 1
  ) {
    throw executionError(
      "INVESTMENT_EXECUTION_RECOMMENDATION_MISMATCH",
      "Investment execution requires exactly one Decision recommendation.",
    );
  }

  const recommendationId =
    decision.recommendationIds[0].value;
  const matches =
    platformAnalysis.recommendations
      .toArray()
      .filter(
        ({ id }) =>
          id.value === recommendationId,
      );

  if (
    matches.length !== 1 ||
    decision.metadata.recommendationId !==
      recommendationId
  ) {
    throw executionError(
      "INVESTMENT_EXECUTION_RECOMMENDATION_MISMATCH",
      "The Decision recommendation does not belong to the supplied Platform analysis.",
    );
  }

  const recommendation = matches[0];
  if (
    recommendation.category !==
      "investment-acquisition" ||
    recommendation.metadata.propertyId !==
      subjectId ||
    recommendation.metadata.runId !==
      platformAnalysis.lineage.runId ||
    recommendation.metadata.acquisitionType !==
      lifecycleResult.acquisitionType
  ) {
    throw executionError(
      "INVESTMENT_EXECUTION_RECOMMENDATION_MISMATCH",
      "The Decision recommendation lacks matching Investment lineage.",
    );
  }
}

function buildExecutionIntents(
  result: InvestmentLifecycleResult,
  platform: InvestmentPlatformAnalysis,
): readonly InvestmentExecutionIntent[] {
  switch (result.acquisitionType) {
    case AcquisitionType.Purchase:
      return purchaseIntents(result, platform);
    case AcquisitionType.RentalArbitrage:
      return rentalIntents(result, platform);
    default:
      return assertNever(result);
  }
}

function purchaseIntents(
  result: Extract<
    InvestmentLifecycleResult,
    {
      acquisitionType:
        AcquisitionType.Purchase;
    }
  >,
  platform: InvestmentPlatformAnalysis,
): readonly InvestmentExecutionIntent[] {
  const intents: InvestmentExecutionIntent[] = [];
  const comparableGaps = matchingGaps(
    platform.dataGaps,
    [
      "synthetic-comparables",
      "unverified-comparable-source",
      "weak-comparable-confidence",
    ],
  );
  const regulationGaps = matchingGaps(
    platform.dataGaps,
    ["missing-regulation-source"],
  );
  const financingRisks =
    result.analysis.risks.filter(
      ({ id }) =>
        id.includes("debt") ||
        id.includes("cash-flow") ||
        id.includes("leverage"),
    );
  const materialRisks =
    result.analysis.risks.filter(
      ({ severity }) =>
        severity === RiskSeverity.Critical ||
        severity === RiskSeverity.High,
    );

  if (comparableGaps.length > 0) {
    intents.push(intent({
      key: "validate-market-comparables",
      title: "Validate market comparables",
      description:
        "Obtain verified comparable performance and reconcile the underwriting assumptions.",
      category: "market-validation",
      priority: "high",
      required: true,
      rationale:
        comparableGaps.map(({ description }) => description).join(" "),
      sourceReferences:
        comparableGaps.map(({ code }) => `data-gap:${code}`),
    }));
  }

  intents.push(intent({
    key: "verify-str-regulations",
    title: "Verify short-term-rental regulations",
    description:
      "Confirm licensing, zoning, occupancy, and operating restrictions for the property.",
    category: "regulatory-diligence",
    priority: regulationGaps.length > 0 ? "high" : "normal",
    required: true,
    rationale:
      regulationGaps[0]?.description ??
      "Regulatory eligibility is a prerequisite to acquisition execution.",
    sourceReferences:
      regulationGaps.map(({ code }) => `data-gap:${code}`),
  }));

  intents.push(intent({
    key: "complete-property-inspection",
    title: "Complete property inspection",
    description:
      "Inspect the property and quantify material repair or operating-readiness issues.",
    category: "property-diligence",
    priority: materialRisks.length > 0 ? "high" : "normal",
    required: true,
    rationale:
      materialRisks.length > 0
        ? "Material underwriting risks require physical diligence before acquisition."
        : "Physical diligence is required before acquisition.",
    sourceReferences:
      materialRisks.map(({ id }) => `risk:${id}`),
  }));

  intents.push(intent({
    key: "validate-financing",
    title: "Validate financing terms",
    description:
      "Obtain lender terms and confirm debt service, leverage, and reserve requirements.",
    category: "financing",
    priority: financingRisks.length > 0 ? "high" : "normal",
    required: true,
    rationale:
      financingRisks.length > 0
        ? financingRisks.map(({ description }) => description).join(" ")
        : "Final debt terms must match the accepted underwriting assumptions.",
    sourceReferences:
      financingRisks.map(({ id }) => `risk:${id}`),
  }));

  intents.push(intent({
    key: "confirm-insurance-and-costs",
    title: "Confirm insurance, taxes, and setup costs",
    description:
      "Validate insurance coverage, property taxes, closing costs, and furnishing estimates.",
    category: "insurance",
    priority: "normal",
    required: true,
    rationale:
      "Final fixed-cost evidence is required before refreshing underwriting.",
    sourceReferences: [],
  }));

  const validationKeys = intents.map(({ key }) => key);
  intents.push(intent({
    key: "refresh-purchase-underwriting",
    title: "Refresh purchase underwriting",
    description:
      "Update the canonical analysis with verified diligence and financing findings.",
    category: "financial-validation",
    priority: "high",
    required: true,
    dependencies: validationKeys,
    rationale:
      result.derivedAnalysis.failurePoints.summary,
    sourceReferences: [
      "failure-points:purchase",
    ],
  }));
  intents.push(intent({
    key: "confirm-final-purchase-thresholds",
    title: "Confirm final investment thresholds",
    description:
      "Verify the refreshed purchase still satisfies the accepted recommendation conditions.",
    category: "final-approval",
    priority: "high",
    required: true,
    dependencies: [
      "refresh-purchase-underwriting",
    ],
    rationale:
      `The accepted recommendation is ${result.analysis.recommendation}.`,
    sourceReferences: [
      "recommendation:accepted",
    ],
  }));
  intents.push(intent({
    key: "prepare-acquisition-offer",
    title: "Prepare acquisition offer",
    description:
      "Prepare an offer aligned with the validated acquisition strategy and thresholds.",
    category: "contracting",
    priority: "normal",
    required: false,
    dependencies: [
      "confirm-final-purchase-thresholds",
    ],
    rationale:
      result.analysis.strategy.primaryOpportunity,
    sourceReferences: [
      "strategy:acquisition",
    ],
  }));

  return resequence(intents);
}

function rentalIntents(
  result: Extract<
    InvestmentLifecycleResult,
    {
      acquisitionType:
        AcquisitionType.RentalArbitrage;
    }
  >,
  platform: InvestmentPlatformAnalysis,
): readonly InvestmentExecutionIntent[] {
  const intents: InvestmentExecutionIntent[] = [];
  const regulationGaps = matchingGaps(
    platform.dataGaps,
    ["missing-regulation-source"],
  );
  const utilitiesGaps = matchingGaps(
    platform.dataGaps,
    ["missing-utilities-responsibility"],
  );
  const comparableGaps = matchingGaps(
    platform.dataGaps,
    [
      "synthetic-comparables",
      "unverified-comparable-source",
      "weak-comparable-confidence",
    ],
  );
  const leaseRisks = result.analysis.risks.filter(
    ({ id }) =>
      id.includes("lease") ||
      id.includes("cash-flow") ||
      id.includes("break-even"),
  );

  intents.push(intent({
    key: "verify-landlord-permission",
    title: "Verify landlord permission",
    description:
      "Obtain written permission for short-term-rental operation and review subletting restrictions.",
    category: "contracting",
    priority: "high",
    required: true,
    rationale:
      "The rental-arbitrage strategy requires explicit lease authority before execution.",
    sourceReferences: [
      "lease:permission",
    ],
  }));
  intents.push(intent({
    key: "verify-str-regulations",
    title: "Verify short-term-rental regulations",
    description:
      "Confirm licensing, zoning, occupancy, and operating restrictions for the leased property.",
    category: "regulatory-diligence",
    priority: regulationGaps.length > 0 ? "high" : "normal",
    required: true,
    rationale:
      regulationGaps[0]?.description ??
      "Regulatory eligibility is required before lease execution.",
    sourceReferences:
      regulationGaps.map(({ code }) => `data-gap:${code}`),
  }));

  if (comparableGaps.length > 0) {
    intents.push(intent({
      key: "validate-market-comparables",
      title: "Validate rental market comparables",
      description:
        "Obtain verified comparable performance before finalizing lease economics.",
      category: "market-validation",
      priority: "high",
      required: true,
      rationale:
        comparableGaps.map(({ description }) => description).join(" "),
      sourceReferences:
        comparableGaps.map(({ code }) => `data-gap:${code}`),
    }));
  }

  if (utilitiesGaps.length > 0) {
    intents.push(intent({
      key: "confirm-utilities-responsibility",
      title: "Confirm utilities responsibility",
      description:
        "Verify lease responsibility and expected cost for every utility.",
      category: "financial-validation",
      priority: "high",
      required: true,
      rationale:
        utilitiesGaps[0].description,
      sourceReferences:
        utilitiesGaps.map(({ code }) => `data-gap:${code}`),
    }));
  }

  intents.push(intent({
    key: "validate-lease-economics",
    title: "Validate lease economics",
    description:
      "Confirm rent, deposit, concessions, lease coverage, and downside break-even thresholds.",
    category: "financial-validation",
    priority: leaseRisks.length > 0 ? "high" : "normal",
    required: true,
    dependencies: intents.map(({ key }) => key),
    rationale:
      leaseRisks.length > 0
        ? leaseRisks.map(({ description }) => description).join(" ")
        : result.derivedAnalysis.failurePoints.summary,
    sourceReferences: [
      ...leaseRisks.map(({ id }) => `risk:${id}`),
      "failure-points:rental-arbitrage",
    ],
  }));
  intents.push(intent({
    key: "validate-setup-capital",
    title: "Validate furnishing and setup capital",
    description:
      "Obtain current estimates for furnishing, deposits, supplies, and launch costs.",
    category: "operational-readiness",
    priority: "normal",
    required: true,
    rationale:
      "Startup capital determines rental-arbitrage return and payback.",
    sourceReferences: [
      "analysis:initial-capital",
    ],
  }));
  intents.push(intent({
    key: "obtain-rental-insurance",
    title: "Obtain rental-arbitrage insurance",
    description:
      "Confirm appropriate liability and property coverage for the operating model.",
    category: "insurance",
    priority: "normal",
    required: true,
    rationale:
      "Insurance coverage is required before the property begins operating.",
    sourceReferences: [],
  }));

  const refreshDependencies = intents.map(({ key }) => key);
  intents.push(intent({
    key: "refresh-rental-underwriting",
    title: "Refresh rental-arbitrage underwriting",
    description:
      "Update the canonical analysis with verified lease, market, utility, and setup findings.",
    category: "financial-validation",
    priority:
      result.derivedAnalysis.stressTests.overallOutcome === "resilient"
        ? "normal"
        : "high",
    required: true,
    dependencies: refreshDependencies,
    rationale:
      result.derivedAnalysis.stressTests.summary,
    sourceReferences: [
      `stress-tests:${result.derivedAnalysis.stressTests.overallOutcome}`,
    ],
  }));
  intents.push(intent({
    key: "execute-approved-lease",
    title: "Execute approved lease",
    description:
      "Execute the lease only after refreshed underwriting satisfies the accepted thresholds.",
    category: "contracting",
    priority: "high",
    required: true,
    dependencies: [
      "refresh-rental-underwriting",
    ],
    rationale:
      `The accepted recommendation is ${result.analysis.recommendation}.`,
    sourceReferences: [
      "recommendation:accepted",
    ],
  }));
  intents.push(intent({
    key: "prepare-operational-launch",
    title: "Prepare operational launch",
    description:
      "Prepare furnishing, listing, pricing, and operating setup after lease execution.",
    category: "operational-readiness",
    priority: "normal",
    required: false,
    dependencies: [
      "execute-approved-lease",
    ],
    rationale:
      "Operational preparation converts the approved lease strategy into launch readiness.",
    sourceReferences: [],
  }));

  return resequence(intents);
}

function intent(
  value: Omit<
    InvestmentExecutionIntent,
    "sequence" | "dependencies"
  > &
    Readonly<{
      dependencies?: readonly string[];
    }>,
): InvestmentExecutionIntent {
  return {
    ...value,
    sequence: 0,
    dependencies:
      value.dependencies ?? [],
  };
}

function resequence(
  intents:
    readonly InvestmentExecutionIntent[],
): readonly InvestmentExecutionIntent[] {
  return intents.map((value, index) => ({
    ...value,
    sequence: index + 1,
    dependencies: [...value.dependencies],
    sourceReferences: [
      ...value.sourceReferences,
    ],
  }));
}

function matchingGaps(
  gaps: readonly InvestmentDataGap[],
  codes: readonly string[],
): readonly InvestmentDataGap[] {
  return gaps.filter(({ code }) =>
    codes.includes(code),
  );
}

function validatePlanningContext(
  context: PlanInvestmentExecutionCommand["context"],
): void {
  if (
    !context.planId.trim() ||
    !context.workspaceId.trim() ||
    !(context.plannedAt instanceof Date) ||
    Number.isNaN(context.plannedAt.getTime())
  ) {
    throw executionError(
      "INVESTMENT_EXECUTION_INVALID_CONTEXT",
      "Investment execution planning context must contain stable IDs and a valid timestamp.",
    );
  }
}

function validateActionIds(
  intents:
    readonly InvestmentExecutionIntent[],
  actionIds: Readonly<Record<string, string>>,
): void {
  const values = intents.map(({ key }) => {
    const value = actionIds[key]?.trim();
    if (!value) {
      throw executionError(
        "INVESTMENT_EXECUTION_ACTION_ID_MISSING",
        `No Action ID was supplied for execution intent ${key}.`,
      );
    }
    return value;
  });

  if (new Set(values).size !== values.length) {
    throw executionError(
      "INVESTMENT_EXECUTION_DUPLICATE_ACTION_ID",
      "Investment execution Action IDs must be unique.",
    );
  }
}

function validateIntents(
  intents:
    readonly InvestmentExecutionIntent[],
): void {
  const keys = intents.map(({ key }) => key);
  if (new Set(keys).size !== keys.length) {
    throw executionError(
      "INVESTMENT_EXECUTION_INVALID_DEPENDENCY",
      "Investment execution intent keys must be unique.",
    );
  }

  const keySet = new Set(keys);
  for (const value of intents) {
    if (
      value.dependencies.includes(value.key) ||
      value.dependencies.some(
        (dependency) =>
          !keySet.has(dependency),
      ) ||
      new Set(value.dependencies).size !==
        value.dependencies.length
    ) {
      throw executionError(
        "INVESTMENT_EXECUTION_INVALID_DEPENDENCY",
        `Execution intent ${value.key} has invalid dependencies.`,
      );
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byKey = new Map(
    intents.map((value) => [value.key, value]),
  );
  const visit = (key: string): void => {
    if (visiting.has(key)) {
      throw executionError(
        "INVESTMENT_EXECUTION_INVALID_DEPENDENCY",
        "Investment execution intent dependencies must be acyclic.",
      );
    }
    if (visited.has(key)) return;
    visiting.add(key);
    for (
      const dependency of
        byKey.get(key)?.dependencies ?? []
    ) {
      visit(dependency);
    }
    visiting.delete(key);
    visited.add(key);
  };
  keys.forEach(visit);
}

function executionError(
  code: InvestmentExecutionErrorCode,
  message: string,
): InvestmentExecutionError {
  return new InvestmentExecutionError(
    code,
    message,
  );
}

function assertNever(value: never): never {
  throw new TypeError(
    `Unsupported Investment execution route: ${String(value)}`,
  );
}
