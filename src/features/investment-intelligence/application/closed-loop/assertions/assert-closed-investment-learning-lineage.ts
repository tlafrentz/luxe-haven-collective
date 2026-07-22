import {
  expect,
} from "vitest";

import type {
  buildInvestmentClosedLoopFixture,
} from "../fixtures/build-investment-closed-loop-fixture";

type Fixture = ReturnType<
  typeof buildInvestmentClosedLoopFixture
>;

export function assertClosedInvestmentLearningLineage(
  fixture: Fixture,
): void {
  const {
    runA,
    runAId,
    recommendation,
    decision,
    executionPlan,
    completedAction,
    outcomeResult,
    learningInsight,
    learningReview,
    learningApplication,
    appliedLearningContext,
    analysisContext,
  } = fixture;
  const subjectId = runA.analysis.property.id;

  expect(recommendation.metadata).toMatchObject({
    propertyId: subjectId,
    acquisitionType: runA.acquisitionType,
    runId: runAId,
  });
  expect(decision.context.subjectId).toBe(subjectId);
  expect(decision.context.scope).toBe(runA.acquisitionType);
  expect(decision.recommendationIds.map(({ value }) => value))
    .toEqual([recommendation.id.value]);
  expect(executionPlan).toMatchObject({
    subjectId,
    acquisitionType: runA.acquisitionType,
    decisionId: decision.id.value,
    recommendationId: recommendation.id.value,
    investmentRunId: runAId,
  });

  const source = (capability: string) =>
    completedAction.sources.find((entry) => entry.capability === capability)?.sourceId;
  expect(source("investment-intelligence")).toBe(decision.id.value);
  expect(completedAction.sources.some(({ capability, sourceId }) =>
    capability === "investment-intelligence" && sourceId === recommendation.id.value,
  )).toBe(true);
  expect(source("investment-execution-plan")).toBe(executionPlan.id);
  expect(source("investment-platform-run")).toBe(runAId);

  expect(outcomeResult.outcome.lineage.actionIds.map(({ value }) => value))
    .toContain(completedAction.id.value);
  expect(outcomeResult.outcome.lineage.decisionIds.map(({ value }) => value))
    .toContain(decision.id.value);
  expect(outcomeResult.outcome.lineage.recommendationIds.map(({ value }) => value))
    .toContain(recommendation.id.value);
  expect(outcomeResult.outcome.metadata).toMatchObject({
    propertyId: subjectId,
    acquisitionType: runA.acquisitionType,
    investmentRunId: runAId,
    executionPlanId: executionPlan.id,
  });

  expect(learningInsight.explainability.supportingOutcomeIds.map(({ value }) => value))
    .toEqual([outcomeResult.outcome.id.value]);
  expect(learningInsight.explainability.lineage.actionIds.map(({ value }) => value))
    .toContain(completedAction.id.value);
  expect(learningInsight.metadata).toMatchObject({
    subjectId,
    acquisitionType: runA.acquisitionType,
    investmentRunId: runAId,
    decisionId: decision.id.value,
    recommendationId: recommendation.id.value,
    executionPlanId: executionPlan.id,
  });

  expect(learningApplication).toMatchObject({
    approvalDecisionId: learningReview.decision.id.value,
    learningInsightIds: [learningInsight.id.value],
    sourceSubjectIds: [subjectId],
    sourceOutcomeIds: [outcomeResult.outcome.id.value],
    sourceInvestmentRunIds: [runAId],
    sourceAcquisitionTypes: [runA.acquisitionType],
  });
  expect(appliedLearningContext.applicationIds).toEqual([learningApplication.id]);
  expect(appliedLearningContext.lineage).toEqual([{
    applicationId: learningApplication.id,
    learningInsightIds: [learningInsight.id.value],
    outcomeIds: [outcomeResult.outcome.id.value],
    investmentRunIds: [runAId],
    approvalDecisionId: learningReview.decision.id.value,
  }]);
  expect(analysisContext.lineage).toEqual(appliedLearningContext.lineage);
  expect(analysisContext.lineage.flatMap(({ investmentRunIds }) => investmentRunIds))
    .toEqual([runAId]);
}
