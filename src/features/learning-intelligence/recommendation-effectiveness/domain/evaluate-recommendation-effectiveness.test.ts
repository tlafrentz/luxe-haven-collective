import { describe, expect, it } from "vitest";
import { createDecisionOutcomeAssessmentId, DEFAULT_DECISION_OUTCOME_POLICY, evaluateDecisionOutcome, type DecisionOutcomeAssessment, type OutcomeClassification } from "../../decision-outcomes";
import { createOutcomeId, createOutcomeOwnerId } from "../../outcomes";
import { planInput, t } from "../../outcomes/domain/outcome.test-support";
import { createRecommendationEffectivenessAssessmentId, createRecommendationTypeId } from "./ids";
import { compareRecommendationEffectiveness, evaluateRecommendationEffectiveness } from "./evaluate-recommendation-effectiveness";
import type { RecommendationInstance } from "./model";
import { DEFAULT_RECOMMENDATION_EFFECTIVENESS_POLICY } from "./policy";
import { Outcome } from "../../outcomes";

const typeId = createRecommendationTypeId("increase-weekend-pricing");
const ownerId = createOutcomeOwnerId("owner-1");
function baseAssessment(id: number): DecisionOutcomeAssessment {
  const outcome = Outcome.plan(planInput({ id: createOutcomeId(`outcome-${id}`), idempotencyKey: `plan-${id}` })).props;
  return evaluateDecisionOutcome({
    assessmentId: createDecisionOutcomeAssessmentId(`outcome-assessment-${id}`), outcome: Object.freeze({ ...outcome, status: "closed" }),
    policy: DEFAULT_DECISION_OUTCOME_POLICY, evaluatedAt: t(13), eventId: `outcome-event-${id}`,
  });
}
function instance(id: number, classification: OutcomeClassification, options: Readonly<{ condition?: string; harm?: boolean }> = {}): RecommendationInstance {
  const base = baseAssessment(id);
  const assessment = Object.freeze({
    ...base, classification,
    harm: Object.freeze({ ...base.harm, material: options.harm ?? classification === "harmful" }),
  });
  return Object.freeze({
    recommendationId: `recommendation-${id}`, recommendationType: typeId, decisionId: `decision-${id}`,
    executionReferences: Object.freeze([`action-${id}`]), outcomeId: assessment.outcomeId,
    outcomeAssessmentId: assessment.id, outcomeStatus: "closed", assessedAt: new Date(t(13).getTime() + id),
    applicability: options.condition ? Object.freeze([{ category: "market" as const, value: options.condition }]) : Object.freeze([]),
    assessment,
  });
}
const evaluate = (instances: readonly RecommendationInstance[], id = "1", previousAssessment?: ReturnType<typeof evaluateRecommendationEffectiveness>) =>
  evaluateRecommendationEffectiveness({
    assessmentId: createRecommendationEffectivenessAssessmentId(`effectiveness-${id}`), ownerId,
    recommendationType: typeId, instances, policy: DEFAULT_RECOMMENDATION_EFFECTIVENESS_POLICY,
    evaluatedAt: t(14), ...(previousAssessment ? { previousAssessment } : {}),
  });

describe("LI-003 Recommendation Effectiveness Engine", () => {
  it("evaluates recommendation types across instances, not a single recommendation", () => {
    const assessment = evaluate([1, 2, 3, 4, 5].map(id => instance(id, "successful")));
    expect(assessment.recommendationType).toBe(typeId);
    expect(assessment.lineage.recommendationIds).toHaveLength(5);
    expect(assessment.outcomeDistribution).toMatchObject({ successful: 5, totalEvaluated: 5 });
    expect(assessment.overall.effectiveness).toBe("highly-effective");
    expect(assessment.overall.quality).toBe("validated");
  });

  it("keeps small successful samples uncertain with explicit sufficiency and null rates", () => {
    const assessment = evaluate([instance(1, "successful"), instance(2, "successful")]);
    expect(assessment.overall.sample).toMatchObject({ outcomeCount: 2, minimumRequired: 5, sufficient: false });
    expect(assessment.overall.metrics.successRate).toBeNull();
    expect(assessment.overall.effectiveness).toBe("insufficient-evidence");
    expect(assessment.repeatability.classification).toBe("unknown");
    expect(assessment.learningReadiness).toBe("insufficient-evidence");
  });

  it("aggregates success, partial success, failure, harm, and inconclusive separately", () => {
    const assessment = evaluate([
      instance(1, "successful"), instance(2, "successful"), instance(3, "partially-successful"),
      instance(4, "unsuccessful"), instance(5, "harmful"), instance(6, "inconclusive"),
    ]);
    expect(assessment.outcomeDistribution).toEqual({ successful: 2, partiallySuccessful: 1, unsuccessful: 1, harmful: 1, inconclusive: 1, totalEvaluated: 6 });
    expect(assessment.overall.metrics.successRate?.value).toBe(40);
    expect(assessment.overall.metrics.inconclusiveRate?.value).toBeCloseTo(16.6667, 3);
  });

  it("preserves repeated harm and applies policy without changing LI-002 classifications", () => {
    const instances = [instance(1, "successful"), instance(2, "successful"), instance(3, "successful"), instance(4, "successful"), instance(5, "harmful", { harm: true })];
    const before = instances.map(value => value.assessment.classification);
    const assessment = evaluate(instances);
    expect(assessment.harm).toMatchObject({ harmfulOutcomeCount: 1, severeHarmObserved: true });
    expect(assessment.overall.effectiveness).toBe("harmful");
    expect(assessment.overall.quality).toBe("deprecated");
    expect(instances.map(value => value.assessment.classification)).toEqual(before);
  });

  it("represents conditional applicability rather than averaging it away", () => {
    const assessment = evaluate([
      instance(1, "successful", { condition: "Austin" }), instance(2, "successful", { condition: "Austin" }),
      instance(3, "unsuccessful", { condition: "Chicago" }), instance(4, "unsuccessful", { condition: "Chicago" }),
      instance(5, "partially-successful", { condition: "Austin" }),
    ]);
    expect(assessment.applicability).toEqual([
      { condition: { category: "market", value: "Austin" }, outcomeCount: 3, beneficialCount: 3, harmfulCount: 0 },
      { condition: { category: "market", value: "Chicago" }, outcomeCount: 2, beneficialCount: 0, harmfulCount: 0 },
    ]);
    expect(assessment.repeatability.limitingFactors).toContain("INCOMPARABLE_CONDITIONS");
    expect(assessment.overall.quality).toBe("conditional");
    expect(assessment.learningReadiness).toBe("limited");
  });

  it("requires completed eligible Outcomes and valid assessment lineage", () => {
    const invalid = Object.freeze({ ...instance(1, "successful"), outcomeStatus: "measuring" as const });
    expect(() => evaluate([invalid])).toThrow(/completed Outcome assessments/);
    const mismatch = Object.freeze({ ...instance(2, "successful"), outcomeAssessmentId: createDecisionOutcomeAssessmentId("other") });
    expect(() => evaluate([mismatch])).toThrow(/lineage is invalid/);
  });

  it("only computes trends for comparable policy-versioned assessments", () => {
    const previous = evaluate([1, 2, 3, 4, 5].map(id => instance(id, "unsuccessful")), "previous");
    const current = evaluate([1, 2, 3, 4, 5, 6].map(id => instance(id, "successful")), "current", previous);
    expect(current.trends).toMatchObject({ direction: "improving", comparableAssessment: true });
    expect(compareRecommendationEffectiveness(previous, current)).toMatchObject({ classification: "improved", comparable: true, newEvidenceCount: 1 });
    const incompatible = evaluateRecommendationEffectiveness({
      assessmentId: createRecommendationEffectivenessAssessmentId("other-policy"), ownerId, recommendationType: typeId,
      instances: [1, 2, 3, 4, 5].map(id => instance(id, "successful")),
      policy: { ...DEFAULT_RECOMMENDATION_EFFECTIVENESS_POLICY, version: "v2" }, evaluatedAt: t(14), previousAssessment: previous,
    });
    expect(incompatible.trends).toMatchObject({ direction: "unknown", comparableAssessment: false });
  });

  it("is deterministic for identical instances, policy, identifiers, and evaluation time", () => {
    const instances = [1, 2, 3, 4, 5].map(id => instance(id, "successful"));
    expect(evaluate(instances)).toEqual(evaluate(instances));
  });
});
