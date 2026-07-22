import type {
  PlatformAction,
} from "@/platform/actions";

import {
  AcquisitionType,
  MarketTrend,
  PropertyType,
  buildInvestmentAnalysisContext,
  buildInvestmentAppliedLearningContext,
  commitInvestmentRecommendation,
  deriveInvestmentLearning,
  mapInvestmentPlatformAnalysis,
  planInvestmentExecution,
  recordInvestmentActionOutcome,
  reviewInvestmentLearningApplication,
  runInvestmentAnalysis,
} from "@/features/investment-intelligence";

import type {
  RunInvestmentAnalysisCommand,
} from "../../run-investment-analysis";

const ACTION_IDS = {
  "validate-market-comparables": "action-market",
  "verify-str-regulations": "action-regulations",
  "complete-property-inspection": "action-inspection",
  "validate-financing": "action-financing",
  "confirm-insurance-and-costs": "action-insurance",
  "refresh-purchase-underwriting": "action-refresh-purchase",
  "confirm-final-purchase-thresholds": "action-final-purchase",
  "prepare-acquisition-offer": "action-offer",
  "verify-landlord-permission": "action-landlord",
  "confirm-utilities-responsibility": "action-utilities",
  "validate-lease-economics": "action-lease-economics",
  "validate-setup-capital": "action-setup",
  "obtain-rental-insurance": "action-rental-insurance",
  "refresh-rental-underwriting": "action-refresh-rental",
  "execute-approved-lease": "action-lease",
  "prepare-operational-launch": "action-launch",
} as const;

export type ClosedLoopRoute = "purchase" | "rental";

export type BuildClosedLoopFixtureOptions = Readonly<{
  explicitRunBValue?: number;
}>;

export function buildInvestmentClosedLoopFixture(
  route: ClosedLoopRoute,
  options: BuildClosedLoopFixtureOptions = {},
) {
  const input = route === "purchase"
    ? purchaseInput()
    : rentalInput();
  const assumptionKey = route === "purchase"
    ? "annual-insurance-premium"
    : "monthly-utilities";
  const assumedValue = route === "purchase" ? 2400 : 300;
  const actualValue = route === "purchase" ? 4800 : 475;
  const intentKey = route === "purchase"
    ? "confirm-insurance-and-costs"
    : "confirm-utilities-responsibility";
  const runAId = `platform-run-a-${route}`;
  const runBId = `platform-run-b-${route}`;

  const runA = runInvestmentAnalysis(input);
  const platformAnalysis = mapInvestmentPlatformAnalysis(runA, {
    runId: runAId,
    observedAt: new Date("2026-04-01T08:00:00Z"),
    sourceQuality: {
      comparables: "synthetic",
      regulation: "unknown",
      utilitiesResponsibility: "unknown",
    },
  });
  const recommendation = platformAnalysis.recommendations.toArray()[0];
  const commitment = commitInvestmentRecommendation({
    lifecycleResult: runA,
    platformAnalysis,
    recommendationId: recommendation.id.value,
    response: "accept",
    rationale: "Proceed to governed diligence.",
    actor: { id: "commitment-actor" },
    context: {
      decisionId: `investment-decision-${route}`,
      decidedAt: new Date("2026-04-01T09:00:00Z"),
    },
  });
  const executionPlan = planInvestmentExecution({
    lifecycleResult: runA,
    platformAnalysis,
    decision: commitment.decision,
    actor: { id: "planning-actor" },
    context: {
      planId: `execution-plan-${route}`,
      workspaceId: "closed-loop-workspace",
      plannedAt: new Date("2026-04-01T10:00:00Z"),
      actionIds: ACTION_IDS,
    },
  });
  const draftAction = executionPlan.actions.find((action) =>
    action.sources.some(({ capability, sourceId }) =>
      capability === "investment-execution-intent" && sourceId === intentKey,
    ),
  );
  if (!draftAction) throw new Error(`Closed-loop fixture is missing ${intentKey}.`);
  const completedAction = completeAction(draftAction);
  const outcomeResult = recordInvestmentActionOutcome({
    action: completedAction,
    platformAnalysis,
    decision: commitment.decision,
    finding: {
      disposition: "unfavorable",
      summary: `Actual ${assumptionKey} exceeds the Run A assumption.`,
      measurements: [{
        key: assumptionKey,
        label: assumptionKey,
        value: actualValue,
        unit: "USD",
        period: route === "purchase" ? "annual" : "monthly",
        assumedValue,
      }],
      assumptionReferences: [assumptionKey],
      source: { kind: "quote", reference: `quote-${route}` },
    },
    actor: { id: "execution-actor" },
    context: {
      outcomeId: `outcome-${route}`,
      recordedAt: new Date("2026-04-02T13:00:00Z"),
    },
  });
  const candidateKey = `subject:property-${route}:assumption:${assumptionKey}:contradicted`;
  const learningResult = deriveInvestmentLearning({
    outcomes: [outcomeResult.outcome],
    priorContext: {
      lifecycleResult: runA,
      platformAnalysis,
      decision: commitment.decision,
      planId: executionPlan.id,
    },
    actor: { id: "deriving-actor" },
    context: {
      learningRunId: `learning-run-${route}`,
      derivedAt: new Date("2026-04-03T08:00:00Z"),
      learningIds: { [candidateKey]: `learning-${route}` },
    },
  });
  const learningInsight = learningResult.learnings[0];
  const reviewResult = reviewInvestmentLearningApplication({
    proposal: {
      id: `learning-proposal-${route}`,
      status: "proposed",
      learningInsightIds: [learningInsight.id.value],
      target: {
        kind: "subject-assumption",
        subjectId: `property-${route}`,
        assumptionKey,
      },
      mode: "replace-assumption",
      previousValue: { value: assumedValue, unit: "USD" },
      proposedValue: { value: actualValue, unit: "USD" },
      rationale: "Use the confirmed actual for this subject only.",
      evidenceSummary: "Completed diligence produced a measured actual.",
      limitations: ["Subject-specific evidence only."],
      effectiveFrom: new Date("2026-04-04T08:00:00Z"),
      proposedBy: { id: "proposing-actor" },
      proposedAt: new Date("2026-04-03T09:00:00Z"),
    },
    learnings: [learningInsight],
    disposition: "approve",
    rationale: "The evidence and subject scope are sufficient.",
    reviewer: { id: "approving-actor" },
    context: {
      reviewId: `learning-review-${route}`,
      decisionId: `learning-approval-decision-${route}`,
      applicationId: `learning-application-${route}`,
      reviewedAt: new Date("2026-04-04T08:00:00Z"),
    },
  });
  if (!reviewResult.application) throw new Error("Approved fixture review did not create an application.");
  const learningApplication = reviewResult.application;

  const historyBeforeRunB = snapshotHistory({
    input,
    runA,
    platformAnalysis,
    recommendation,
    decision: commitment.decision,
    executionPlan,
    draftAction,
    completedAction,
    outcome: outcomeResult.outcome,
    learningInsight,
    learningApplication,
  });
  const appliedLearningContext = buildInvestmentAppliedLearningContext({
    subjectId: `property-${route}`,
    acquisitionType: route === "purchase" ? AcquisitionType.Purchase : AcquisitionType.RentalArbitrage,
    marketId: "mesa",
    applications: [learningApplication],
    analysisDate: new Date("2026-04-05T08:00:00Z"),
  });
  const runBInput = options.explicitRunBValue === undefined
    ? input
    : withAssumption(input, assumptionKey, options.explicitRunBValue);
  const analysisContext = buildInvestmentAnalysisContext({
    input: runBInput,
    userProvidedAssumptionKeys: options.explicitRunBValue === undefined ? [] : [assumptionKey],
    appliedLearning: appliedLearningContext,
  });
  const runB = runInvestmentAnalysis(analysisContext.input);
  const runBPlatformAnalysis = mapInvestmentPlatformAnalysis(runB, {
    runId: runBId,
    observedAt: new Date("2026-04-05T09:00:00Z"),
    sourceQuality: {
      comparables: "synthetic",
      regulation: "unknown",
      utilitiesResponsibility: "unknown",
    },
  });

  return {
    route,
    assumptionKey,
    assumedValue,
    actualValue,
    input,
    runA,
    runAId,
    platformAnalysis,
    recommendation,
    decision: commitment.decision,
    executionPlan,
    draftAction,
    completedAction,
    outcomeResult,
    learningResult,
    learningInsight,
    learningReview: reviewResult.review,
    learningApplication,
    appliedLearningContext,
    analysisContext,
    runB,
    runBId,
    runBPlatformAnalysis,
    historyBeforeRunB,
  } as const;
}

export function snapshotHistory(value: unknown): string {
  return JSON.stringify(value);
}

function purchaseInput(): RunInvestmentAnalysisCommand {
  return {
    acquisitionType: AcquisitionType.Purchase,
    property: {
      id: "property-purchase", address1: "100 Main St", city: "Mesa", state: "AZ", postalCode: "85201",
      purchasePrice: 425000, closingCosts: 12000, furnishingBudget: 25000,
      propertyType: PropertyType.Apartment, bedrooms: 2, bathrooms: 1, squareFeet: 950,
    },
    financing: { downPaymentPercentage: 25, interestRatePercentage: 6.5, loanTermYears: 30 },
    revenue: { projectedAdr: 200, projectedOccupancyPercentage: 75, averageLengthOfStay: 4 },
    operating: {
      managementFeePercentage: 10, monthlyUtilities: 300, annualInsurance: 2400, annualTaxes: 4200,
      annualCleaning: 7200, annualSoftware: 1200, annualSupplies: 1800,
      maintenanceReservePercentage: 5, capitalReservePercentage: 3,
    },
    market: { name: "Mesa", medianAdr: 180, medianOccupancyPercentage: 70, trend: MarketTrend.Stable },
    comparables: [comparable()],
  };
}

function rentalInput(): RunInvestmentAnalysisCommand {
  return {
    acquisitionType: AcquisitionType.RentalArbitrage,
    property: {
      id: "property-rental", address1: "200 Main St", city: "Mesa", state: "AZ", postalCode: "85201",
      furnishingBudget: 15000, propertyType: PropertyType.Apartment, bedrooms: 2, bathrooms: 1, squareFeet: 950,
    },
    lease: { monthlyLease: 2200, securityDeposit: 2200, leaseTermMonths: 12, startupCosts: 3000, utilitiesIncluded: false },
    revenue: { projectedAdr: 200, projectedOccupancyPercentage: 75, averageLengthOfStay: 4 },
    operating: {
      managementFeePercentage: 10, monthlyUtilities: 300, annualInsurance: 1200,
      annualCleaning: 6000, annualSoftware: 600, annualSupplies: 1200,
      maintenanceReservePercentage: 3, capitalReservePercentage: 2,
    },
    market: { name: "Mesa", medianAdr: 180, medianOccupancyPercentage: 70, trend: MarketTrend.Stable },
    comparables: [comparable()],
  };
}

function comparable() {
  return {
    id: "comparable-1", distanceMiles: 1, bedrooms: 2, bathrooms: 1,
    averageDailyRate: { amount: 190, currency: "USD" as const }, occupancy: { value: 70 },
    rating: { value: 4.8, max: 5 as const }, reviewCount: 100, amenities: ["Kitchen"],
  };
}

function completeAction(action: PlatformAction): PlatformAction {
  const actor = { type: "user" as const, id: "execution-actor" };
  const mutate = (value: PlatformAction, occurredAt: string) => ({
    workspaceId: value.workspaceId,
    expectedVersion: value.version,
    actor,
    occurredAt: new Date(occurredAt),
  });
  const committed = action.commit(mutate(action, "2026-04-02T08:00:00Z"));
  const ready = committed.markReady(mutate(committed, "2026-04-02T09:00:00Z"));
  const started = ready.start(mutate(ready, "2026-04-02T10:00:00Z"));
  return started.complete(mutate(started, "2026-04-02T12:00:00Z"));
}

function withAssumption(
  input: RunInvestmentAnalysisCommand,
  assumptionKey: string,
  value: number,
): RunInvestmentAnalysisCommand {
  if (assumptionKey === "annual-insurance-premium") {
    if (input.acquisitionType !== AcquisitionType.Purchase) throw new Error("Purchase input required.");
    return { ...input, operating: { ...input.operating, annualInsurance: value } };
  }
  if (input.acquisitionType !== AcquisitionType.RentalArbitrage) throw new Error("Rental input required.");
  return { ...input, operating: { ...input.operating, monthlyUtilities: value } };
}
