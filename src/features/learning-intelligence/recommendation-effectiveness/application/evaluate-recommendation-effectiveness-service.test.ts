import { Result } from "@/platform/kernel";
import { describe, expect, it, vi } from "vitest";
import { createDecisionOutcomeAssessmentId, DEFAULT_DECISION_OUTCOME_POLICY, evaluateDecisionOutcome } from "../../decision-outcomes";
import { Outcome, createOutcomeId, createOutcomeOwnerId } from "../../outcomes";
import { planInput, t } from "../../outcomes/domain/outcome.test-support";
import {
  createRecommendationEffectivenessAssessmentId, createRecommendationTypeId,
  DEFAULT_RECOMMENDATION_EFFECTIVENESS_POLICY,
} from "../domain";
import { InMemoryRecommendationEffectivenessRepository } from "../infrastructure";
import type {
  RecommendationEffectivenessAuthorization, RecommendationEffectivenessEvent,
  RecommendationInstanceReference,
} from "./contracts";
import { evaluateRecommendationEffectivenessService } from "./evaluate-recommendation-effectiveness-service";

const ownerId = createOutcomeOwnerId("owner-1");
const typeId = createRecommendationTypeId("increase-weekend-pricing");
function data(id: number) {
  const outcome = Outcome.plan(planInput({ id: createOutcomeId(`service-outcome-${id}`), idempotencyKey: `service-plan-${id}` })).props;
  const assessment = evaluateDecisionOutcome({
    assessmentId: createDecisionOutcomeAssessmentId(`service-outcome-assessment-${id}`),
    outcome: Object.freeze({ ...outcome, status: "closed" }), policy: DEFAULT_DECISION_OUTCOME_POLICY,
    evaluatedAt: t(13), eventId: `service-outcome-event-${id}`,
  });
  const classified = Object.freeze({ ...assessment, classification: "successful" as const });
  const reference: RecommendationInstanceReference = Object.freeze({
    recommendationId: `recommendation-${id}`, recommendationType: typeId, decisionId: `decision-${id}`,
    executionReferences: Object.freeze([`action-${id}`]), outcomeId: outcome.id,
    outcomeAssessmentId: classified.id, outcomeStatus: "closed", applicability: Object.freeze([]), assessedAt: t(13),
  });
  return { reference, assessment: classified };
}
const all = [1, 2, 3, 4, 5].map(data);
const allow: RecommendationEffectivenessAuthorization = { canEvaluateRecommendationType: async () => true };
const query = () => ({
  ownerId, recommendationType: typeId, assessmentId: createRecommendationEffectivenessAssessmentId("effectiveness-1"),
  policy: DEFAULT_RECOMMENDATION_EFFECTIVENESS_POLICY, evaluatedAt: t(14), expectedVersion: null,
  instanceLimit: 100, eventId: "effectiveness-event-1",
});

describe("LI-003 effectiveness application service", () => {
  it("authorizes before reading recommendation history", async () => {
    const recommendations = { listCompletedInstances: vi.fn(async () => Result.ok([])) };
    const result = await evaluateRecommendationEffectivenessService({
      recommendations, outcomeAssessments: { findAssessments: async () => Result.ok([]) },
      repository: new InMemoryRecommendationEffectivenessRepository(),
      authorization: { canEvaluateRecommendationType: async () => false },
    }, query());
    expect(result).toMatchObject({ isFailure: true, error: { code: "RECOMMENDATION_EFFECTIVENESS_NOT_AUTHORIZED" } });
    expect(recommendations.listCompletedInstances).not.toHaveBeenCalled();
  });

  it("joins bounded instance lineage to authoritative LI-002 assessments and persists", async () => {
    const repository = new InMemoryRecommendationEffectivenessRepository();
    const events: RecommendationEffectivenessEvent[] = [];
    const result = await evaluateRecommendationEffectivenessService({
      recommendations: { listCompletedInstances: async () => Result.ok(all.map(value => value.reference)) },
      outcomeAssessments: { findAssessments: async () => Result.ok(all.map(value => value.assessment)) },
      repository, authorization: allow, events: { publish: async event => { events.push(event); } },
    }, query());
    expect(result.isSuccess && result.value.overall.effectiveness).toBe("highly-effective");
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("RecommendationReadyForLearning");
    const stored = await repository.findLatest(ownerId, typeId);
    expect(stored.isSuccess && stored.value?.version).toBe(1);
  });

  it("fails safely when an authoritative assessment is missing", async () => {
    const result = await evaluateRecommendationEffectivenessService({
      recommendations: { listCompletedInstances: async () => Result.ok(all.map(value => value.reference)) },
      outcomeAssessments: { findAssessments: async () => Result.ok(all.slice(1).map(value => value.assessment)) },
      repository: new InMemoryRecommendationEffectivenessRepository(), authorization: allow,
    }, query());
    expect(result).toMatchObject({ isFailure: true, error: { code: "RECOMMENDATION_OUTCOME_ASSESSMENT_MISSING", assessmentId: "service-outcome-assessment-1" } });
  });

  it("enforces optimistic append-only assessment history and owner scope", async () => {
    const repository = new InMemoryRecommendationEffectivenessRepository();
    const dependencies = {
      recommendations: { listCompletedInstances: async () => Result.ok(all.map(value => value.reference)) },
      outcomeAssessments: { findAssessments: async () => Result.ok(all.map(value => value.assessment)) },
      repository, authorization: allow,
    };
    expect((await evaluateRecommendationEffectivenessService(dependencies, query())).isSuccess).toBe(true);
    const stale = await evaluateRecommendationEffectivenessService(dependencies, { ...query(), assessmentId: createRecommendationEffectivenessAssessmentId("effectiveness-2") });
    expect(stale).toMatchObject({ isFailure: true, error: { code: "RECOMMENDATION_EFFECTIVENESS_VERSION_CONFLICT", currentVersion: 1 } });
    const next = await evaluateRecommendationEffectivenessService(dependencies, {
      ...query(), assessmentId: createRecommendationEffectivenessAssessmentId("effectiveness-2"), expectedVersion: 1, eventId: "event-2",
    });
    expect(next.isSuccess && next.value.version).toBe(2);
    expect(await repository.findLatest(createOutcomeOwnerId("other"), typeId)).toMatchObject({ isSuccess: true, value: null });
  });
});
