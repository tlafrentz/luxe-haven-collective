import { Money, Percentage } from "@/platform/kernel";
import { ConfidenceAssessment, ConfidenceScore } from "@/platform/scoring";
import { Outcome } from "./outcome";
import {
  createOutcomeExpectationId, createOutcomeId, createOutcomeMeasurementId,
  createOutcomeMeasurementPlanId, createOutcomeMeasurementWindowId,
  createOutcomeMetricKey, createOutcomeOwnerId,
} from "./outcome-id";
import type { OutcomeExpectation, OutcomeMeasurement, OutcomeMetricDefinition } from "./outcome-model";

export const t = (day: number) => new Date(`2026-01-${String(day).padStart(2, "0")}T00:00:00.000Z`);
export const confidence = (score = 80) => ConfidenceAssessment.create({ score: ConfidenceScore.create(score), rationale: ["verified"] });
export const windowId = createOutcomeMeasurementWindowId("primary-window");
export const expectationId = createOutcomeExpectationId("adr-expectation");
export const metric: OutcomeMetricDefinition = Object.freeze({
  key: createOutcomeMetricKey("average-daily-rate"), name: "Average daily rate", kind: "money",
  aggregation: "average", directionality: "higher-is-better",
});
export const expectation: OutcomeExpectation = Object.freeze({
  id: expectationId, metric, direction: "increase", baseline: null,
  target: Object.freeze({ type: "absolute", value: Object.freeze({ kind: "money", value: Money.usd(210) }) }),
  importance: "primary", measurementWindowId: windowId,
  source: Object.freeze({ type: "decision", decisionId: "decision-1" }),
  confidence: confidence(), establishedAt: t(1), reconstructed: false,
});
export function planInput(overrides: Record<string, unknown> = {}) {
  const quality = confidence();
  return {
    id: createOutcomeId("outcome-1"), ownerId: createOutcomeOwnerId("owner-1"),
    subject: Object.freeze({ type: "property" as const, propertyId: "property-1" }),
    origin: Object.freeze({ type: "decision" as const, decisionId: "decision-1", decisionVersion: 2 }),
    planningMode: "prospective" as const, expectations: Object.freeze([expectation]),
    measurementPlan: Object.freeze({
      id: createOutcomeMeasurementPlanId("plan-1"), version: 1,
      windows: Object.freeze([Object.freeze({ id: windowId, type: "primary" as const, start: t(2), end: t(10), status: "planned" as const })]),
      requiredExpectations: Object.freeze([expectationId]), evidenceRequirements: Object.freeze([]),
      completionPolicy: Object.freeze({ requiredWindowIds: Object.freeze([windowId]), minimumRequiredMeasurements: 1, requireEveryPrimaryExpectation: true, allowPartialCompletion: false, lateEvidencePolicy: "reject" as const }),
      attributionPlan: Object.freeze({ required: false, approvedBases: Object.freeze(["before-after-comparison" as const]) }),
      approvedAt: t(1), approvedBy: Object.freeze({ type: "user" as const, id: "user-1" }),
    }),
    confidence: Object.freeze({ assessment: quality, expectationQuality: quality, measurementQuality: quality, attributionQuality: quality, evidenceCoverage: Percentage.create(100), penalties: Object.freeze([]) }),
    lineage: Object.freeze({
      decisionReferences: Object.freeze([Object.freeze({ decisionId: "decision-1", decisionVersion: 2 })]),
      recommendationReferences: Object.freeze([]),
      executionReferences: Object.freeze([Object.freeze({ type: "action" as const, actionId: "action-1", actionVersion: 3, completedAt: t(1), completion: "complete" as const })]),
      observationReferences: Object.freeze([]), analysisReferences: Object.freeze([]),
    }),
    plannedAt: t(1), idempotencyKey: "plan-key", ...overrides,
  };
}
export function plannedOutcome() { return Outcome.plan(planInput()); }
export function measurement(overrides: Partial<OutcomeMeasurement> = {}): OutcomeMeasurement {
  return Object.freeze({
    id: createOutcomeMeasurementId("measurement-1"), expectationId, metric,
    value: Object.freeze({ kind: "money", value: Money.usd(220) }), measurementWindowId: windowId,
    observedAt: t(5), recordedAt: t(6), source: Object.freeze({ type: "platform-observation", observationId: "observation-1" }),
    observationReference: Object.freeze({ observationId: "observation-1" }), methodology: "period-aggregation",
    confidence: confidence(), dataQuality: Object.freeze({ completeness: Percentage.create(100), freshness: "current", provenance: "verified", compatibility: "compatible", issues: Object.freeze([]) }),
    status: "authoritative", late: false, ...overrides,
  });
}
