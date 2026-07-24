import { Money, Percentage } from "@/platform/kernel";
import { Score, ScoreScale } from "@/platform/scoring";
import { describe, expect, it } from "vitest";
import {
  createOutcomeExpectationId, createOutcomeMeasurementId,
  createOutcomeQualitativeObservationId, type OutcomeState,
} from "../../outcomes";
import { measurement, plannedOutcome, t, windowId, confidence, expectation } from "../../outcomes/domain/outcome.test-support";
import { createDecisionOutcomeAssessmentId } from "./assessment-id";
import { DEFAULT_DECISION_OUTCOME_POLICY } from "./decision-outcome-policy";
import { calculateVariance, compareDecisionOutcomeAssessments, evaluateDecisionOutcome } from "./evaluate-decision-outcome";

function closedState(): OutcomeState {
  const outcome = plannedOutcome();
  outcome.startMeasurement({ occurredAt: t(2), idempotencyKey: "start" });
  outcome.recordMeasurement(measurement(), { occurredAt: t(6), idempotencyKey: "record" });
  outcome.closeWindow(windowId, { occurredAt: t(10), idempotencyKey: "close-window" });
  outcome.completeMeasurement({ occurredAt: t(11), idempotencyKey: "complete" });
  outcome.updateAttribution({
    status: "supported", basis: [{ type: "before-after-comparison", evidence: [] }],
    competingFactors: [], confidence: confidence(),
  }, { occurredAt: t(11), idempotencyKey: "attribution" });
  outcome.close({ occurredAt: t(12), idempotencyKey: "close" });
  return outcome.props;
}
const evaluate = (outcome: OutcomeState, suffix = "1") => evaluateDecisionOutcome({
  assessmentId: createDecisionOutcomeAssessmentId(`assessment-${suffix}`), outcome,
  policy: DEFAULT_DECISION_OUTCOME_POLICY, evaluatedAt: t(13), eventId: `event-${suffix}`,
});

describe("LI-002 Decision Outcome Engine", () => {
  it("classifies achieved primary objectives successfully without mutating Outcome", () => {
    const state = closedState();
    const snapshot = state.measurements[0]!.value;
    const assessment = evaluate(state);
    expect(assessment.classification).toBe("successful");
    expect(assessment.objectives[0]).toMatchObject({ status: "exceeded", withinTolerance: true });
    expect(assessment.objectives[0]!.actual).toBe(snapshot);
    expect(state).not.toHaveProperty("classification");
    expect(assessment.policyVersion).toBe("decision-outcome-policy/v1");
  });

  it("calculates signed Money, Percentage, ratio, count, and Score variance with Platform primitives", () => {
    expect(calculateVariance({ kind: "money", value: Money.usd(100) }, { kind: "money", value: Money.usd(90) })).toMatchObject({ kind: "money", absolute: { props: { amount: -10 } }, relativePercentage: -10, direction: "negative" });
    expect(calculateVariance({ kind: "percentage", value: Percentage.create(50) }, { kind: "percentage", value: Percentage.create(55) })).toMatchObject({ absolutePercentagePoints: 5, relativePercentage: 10 });
    expect(calculateVariance({ kind: "ratio", value: 2 }, { kind: "ratio", value: 3 })).toMatchObject({ absolute: 1, relativePercentage: 50 });
    expect(calculateVariance({ kind: "count", value: 10 }, { kind: "count", value: 8 })).toMatchObject({ absolute: -2, relativePercentage: -20 });
    expect(calculateVariance({ kind: "score", value: Score.create(80) }, { kind: "score", value: Score.create(90) })).toMatchObject({ absolute: 10, scale: { minimum: 0, maximum: 100 } });
    expect(() => calculateVariance({ kind: "score", value: Score.create(4, ScoreScale.ZERO_TO_FIVE) }, { kind: "score", value: Score.create(80) })).toThrow(/matching scales/);
  });

  it("preserves guardrail failure independently and applies configured precedence", () => {
    const state = closedState();
    const guardrailId = createOutcomeExpectationId("occupancy-guardrail");
    const guardrail = Object.freeze({
      ...expectation, id: guardrailId, importance: "guardrail" as const, direction: "maintain" as const,
      target: Object.freeze({ type: "maximum" as const, value: Object.freeze({ kind: "money" as const, value: Money.usd(230) }) }),
    });
    const guardMeasurement = measurement({ id: createOutcomeMeasurementId("guard-measurement"), expectationId: guardrailId, value: { kind: "money", value: Money.usd(240) } });
    const assessment = evaluate(Object.freeze({ ...state, expectations: Object.freeze([...state.expectations, guardrail]), measurements: Object.freeze([...state.measurements, guardMeasurement]) }));
    expect(assessment.objectives.map(value => value.status)).toEqual(["exceeded", "missed"]);
    expect(assessment.guardrails).toMatchObject({ total: 1, violated: 1, preserved: 0 });
    expect(assessment.classification).toBe("partially-successful");
  });

  it("preserves unexpected effects and lets material negative harm override success", () => {
    const state = closedState();
    const observation = Object.freeze({
      id: createOutcomeQualitativeObservationId("unexpected-harm"), category: "unexpected-effect" as const,
      value: "unexpected-negative" as const, observedAt: t(8), recordedAt: t(9),
      evidence: Object.freeze([]), confidence: confidence(),
    });
    const assessment = evaluate(Object.freeze({ ...state, qualitativeObservations: Object.freeze([observation]) }));
    expect(assessment.unexpectedEffects[0]).toMatchObject({ disposition: "negative", value: "unexpected-negative" });
    expect(assessment.harm).toMatchObject({ detected: true, material: true, overrideApplied: true });
    expect(assessment.classification).toBe("harmful");
  });

  it("returns inconclusive instead of fabricating missing measurements or baselines", () => {
    const state = closedState();
    const missing = evaluate(Object.freeze({ ...state, measurements: Object.freeze([]) }));
    expect(missing.classification).toBe("inconclusive");
    expect(missing.objectives[0]).toMatchObject({ status: "not-measured", actual: null, variance: null });
    const relative = Object.freeze({ ...expectation, target: Object.freeze({ type: "relative-change" as const, value: Percentage.create(5) }), baseline: null });
    const noBaseline = evaluate(Object.freeze({ ...state, expectations: Object.freeze([relative]) }), "baseline");
    expect(noBaseline.objectives[0]).toMatchObject({ status: "unknown", reasonCode: "MISSING_BASELINE" });
  });

  it("keeps confidence, evidence sufficiency, attribution, classification, and learning readiness separate", () => {
    const state = closedState();
    const ready = evaluate(state);
    expect(ready.classification).toBe("successful");
    expect(ready.confidence.assessment.score.value).toBeGreaterThan(0);
    expect(ready.evidence.sufficiency).toBe("sufficient");
    expect(ready.learningReadiness).toBe("ready");
    const blocked = evaluate(Object.freeze({ ...state, attribution: Object.freeze({ ...state.attribution, status: "unknown" as const }) }), "blocked");
    expect(blocked.classification).toBe("successful");
    expect(blocked.learningReadiness).toBe("blocked");
  });

  it("is deterministic for identical Outcome, policy, time, IDs, and evidence", () => {
    const state = closedState();
    expect(evaluate(state)).toEqual(evaluate(state));
  });

  it("compares reevaluations after late evidence without rewriting history", () => {
    const state = closedState();
    const previous = evaluate(Object.freeze({ ...state, measurements: Object.freeze([]) }), "previous");
    const current = evaluateDecisionOutcome({
      assessmentId: createDecisionOutcomeAssessmentId("assessment-current"), outcome: state,
      policy: DEFAULT_DECISION_OUTCOME_POLICY, evaluatedAt: t(14), eventId: "event-current", previousAssessment: previous,
    });
    const comparison = compareDecisionOutcomeAssessments(previous, current);
    expect(current).toMatchObject({ version: 2, classification: "successful", previousAssessmentId: { value: "assessment-previous" } });
    expect(current.events[0]!.type).toBe("DecisionOutcomeReclassified");
    expect(comparison).toMatchObject({ classificationChanged: true, fromClassification: "inconclusive", toClassification: "successful" });
  });
});
