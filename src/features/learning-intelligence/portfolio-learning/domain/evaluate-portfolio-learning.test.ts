import { Money } from "@/platform/kernel";
import { describe, expect, it } from "vitest";
import { createDecisionOutcomeAssessmentId, DEFAULT_DECISION_OUTCOME_POLICY, evaluateDecisionOutcome, type DecisionOutcomeAssessment, type OutcomeClassification } from "../../decision-outcomes";
import { Outcome, createOutcomeId, createOutcomeMetricKey, createOutcomeOwnerId } from "../../outcomes";
import { planInput, t } from "../../outcomes/domain/outcome.test-support";
import { createPortfolioLearningAssessmentId } from "./ids";
import { evaluatePortfolioLearning } from "./evaluate-portfolio-learning";
import type { EvaluatePortfolioLearningInput, PortfolioLearningAssessmentContext } from "./model";
import { DEFAULT_PORTFOLIO_LEARNING_POLICY } from "./policy";

const ownerId = createOutcomeOwnerId("owner-1");
function assessment(id: number, classification: OutcomeClassification, overrides: Partial<DecisionOutcomeAssessment> = {}): DecisionOutcomeAssessment {
  const outcome = Outcome.plan(planInput({ id: createOutcomeId(`learning-outcome-${id}`), idempotencyKey: `learning-plan-${id}` })).props;
  const base = evaluateDecisionOutcome({
    assessmentId: createDecisionOutcomeAssessmentId(`decision-assessment-${id}`), outcome: Object.freeze({ ...outcome, status: "closed" }),
    policy: DEFAULT_DECISION_OUTCOME_POLICY, evaluatedAt: t(13), eventId: `decision-event-${id}`,
  });
  return Object.freeze({ ...base, classification, learningReadiness: "ready", ...overrides });
}
function context(id: number, patch: Partial<PortfolioLearningAssessmentContext> = {}): PortfolioLearningAssessmentContext {
  return Object.freeze({
    assessmentId: createDecisionOutcomeAssessmentId(`decision-assessment-${id}`), decisionType: "renovation",
    subjectId: `property-${id}`, propertyId: `property-${id}`, market: id % 2 ? "Austin" : "Chicago",
    propertyType: "urban", operatingModel: "managed", seasonality: "high-demand",
    executionSpeed: "fast", periodKey: id < 4 ? "2026-01" : "2026-02", ...patch,
  });
}
function input(decisions: readonly DecisionOutcomeAssessment[], contexts = decisions.map((_, index) => context(index + 1)), patch: Partial<EvaluatePortfolioLearningInput> = {}): EvaluatePortfolioLearningInput {
  return {
    assessmentId: createPortfolioLearningAssessmentId("portfolio-learning-assessment-1"),
    portfolio: Object.freeze({
      portfolioId: "portfolio-1", ownerId, portfolioVersion: 4, lifecycleStage: "operating",
      propertyReferences: Object.freeze(contexts.map(value => Object.freeze({ propertyId: value.propertyId ?? value.subjectId, market: value.market, propertyType: value.propertyType, operatingModel: value.operatingModel }))),
      strategyReferences: Object.freeze([]), assessmentContexts: Object.freeze(contexts), capturedAt: t(13),
    }),
    decisionOutcomes: decisions, recommendationEffectiveness: Object.freeze([]),
    policy: DEFAULT_PORTFOLIO_LEARNING_POLICY, evaluatedAt: t(14),
    observationWindow: Object.freeze({ start: t(1), end: t(14) }), ...patch,
  };
}

describe("LI-004 Portfolio Learning Engine", () => {
  it("detects a repeated portfolio decision-success pattern with evidence, recurrence, and scope", () => {
    const result = evaluatePortfolioLearning(input([1, 2, 3, 4, 5].map(id => assessment(id, "successful"))));
    const learning = result.learnings.find(value => value.statementCode === "DECISION_TYPE_SUCCESS_REPEATABLE");
    expect(learning).toBeDefined();
    expect(learning?.pattern.recurrence).toMatchObject({ supportingCount: 5, contradictingCount: 0, observedAcrossDistinctSubjects: 5, observedAcrossDistinctPeriods: 2 });
    expect(learning?.evidence.decisionOutcomeAssessments).toHaveLength(5);
    expect(learning?.scope.decisionTypes).toEqual(["renovation"]);
    expect(learning?.pattern.relationship).toBe("associated-with");
  });

  it("keeps one outcome as a candidate rather than validated organizational learning", () => {
    const result = evaluatePortfolioLearning(input([assessment(1, "successful")]));
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.sample.sufficient).toBe(false);
    expect(result.learnings).toHaveLength(0);
  });

  it("preserves contradictory evidence and contests materially mixed patterns", () => {
    const decisions = [
      assessment(1, "successful"), assessment(2, "successful"), assessment(3, "successful"),
      assessment(4, "unsuccessful"), assessment(5, "unsuccessful"),
    ];
    const result = evaluatePortfolioLearning(input(decisions));
    const learning = result.learnings.find(value => value.statementCode === "DECISION_TYPE_SUCCESS_REPEATABLE");
    expect(learning?.contradictions).toMatchObject({ status: "material", count: 2 });
    expect(learning?.maturity).toBe("contested");
    expect(learning?.contradictions.references).toHaveLength(2);
  });

  it("detects systematic assumption bias using authoritative LI-002 variance and a median resistant to outliers", () => {
    const metric = createOutcomeMetricKey("acquisition-revenue");
    const values = [-10, -12, -9, -11, -1000];
    const decisions = values.map((amount, index) => {
      const base = assessment(index + 1, "unsuccessful");
      const objective = Object.freeze({
        ...base.objectives[0]!, metric: Object.freeze({ ...base.objectives[0]!.metric, key: metric }),
        variance: Object.freeze({ kind: "money" as const, absolute: Money.usd(amount), relativePercentage: amount, currency: "USD", direction: "negative" as const }),
      });
      return Object.freeze({ ...base, objectives: Object.freeze([objective]) });
    });
    const result = evaluatePortfolioLearning(input(decisions));
    const candidate = result.candidates.find(value => value.statementCode === "ASSUMPTIONS_SYSTEMATICALLY_OPTIMISTIC");
    expect(candidate?.observedEffect).toMatchObject({ kind: "quantitative", direction: "decrease", methodology: "median" });
    if (candidate?.observedEffect.kind === "quantitative" && candidate.observedEffect.centralEstimate?.kind === "money") {
      expect(candidate.observedEffect.centralEstimate.value.amount).toBe(-11);
    }
  });

  it("detects measurement limitations without treating them as business failure", () => {
    const decisions = [1, 2, 3].map(id => {
      const base = assessment(id, "inconclusive");
      return Object.freeze({ ...base, objectives: Object.freeze(base.objectives.map(value => Object.freeze({ ...value, reasonCode: "MISSING_BASELINE" as const }))) });
    });
    const result = evaluatePortfolioLearning(input(decisions));
    const learning = result.learnings.find(value => value.statementCode === "MISSING_BASELINES_LIMIT_LEARNING");
    expect(learning?.category).toBe("measurement");
    expect(learning?.type).toBe("measurement-pattern");
    expect(learning?.pattern.relationship).toBe("measurement-limitation");
  });

  it("supports exceptional severe harm without labeling it repeatable", () => {
    const base = assessment(1, "harmful");
    const harmful = Object.freeze({ ...base, harm: Object.freeze({ ...base.harm, material: true }) });
    const result = evaluatePortfolioLearning(input([harmful]));
    expect(result.exceptionalLearnings[0]).toMatchObject({ severity: "critical", recurrenceRequired: false, limitationCode: "SINGLE_EVENT" });
    expect(result.learnings).toHaveLength(0);
  });

  it("excludes incomplete and incompatible assessments while surfacing degradation", () => {
    const incomplete = Object.freeze({ ...assessment(1, "successful"), learningReadiness: "incomplete" as const });
    const incompatible = Object.freeze({ ...assessment(2, "successful"), policyVersion: "unknown-policy" });
    const result = evaluatePortfolioLearning(input([incomplete, incompatible], [context(1), context(2)]));
    expect(result.candidates).toHaveLength(0);
    expect(result.limitations).toContainEqual(expect.objectContaining({ code: "LEARNING_POLICY_INCOMPATIBLE" }));
  });

  it("is deterministic and independent of input order", () => {
    const decisions = [1, 2, 3, 4, 5].map(id => assessment(id, "successful"));
    const forward = evaluatePortfolioLearning(input(decisions));
    const reverse = evaluatePortfolioLearning(input([...decisions].reverse(), [...decisions].reverse().map(value => context(Number(value.id.value.split("-").at(-1))))));
    expect(reverse.snapshotFingerprint).toBe(forward.snapshotFingerprint);
    expect(reverse.learnings.map(value => value.key)).toEqual(forward.learnings.map(value => value.key));
  });

  it("compares compatible immutable learning history and preserves predecessor lineage", () => {
    const firstDecisions = [1, 2, 3].map(id => assessment(id, "successful"));
    const previous = evaluatePortfolioLearning(input(firstDecisions));
    const currentDecisions = [1, 2, 3, 4, 5].map(id => assessment(id, "successful"));
    const current = evaluatePortfolioLearning(input(currentDecisions, currentDecisions.map((_, index) => context(index + 1)), {
      assessmentId: createPortfolioLearningAssessmentId("portfolio-learning-assessment-2"),
      previousAssessment: previous,
    }));
    expect(current.version).toBe(2);
    expect(current.learnings[0]?.lineage.predecessorLearningId).toEqual(previous.learnings[0]?.id);
    expect(current.changes[0]).toMatchObject({ comparable: true, direction: "broadened" });
    expect(previous.version).toBe(1);
  });
});
