import { Result } from "@/platform/kernel";
import { describe, expect, it, vi } from "vitest";
import { createOutcomeOwnerId } from "../../outcomes";
import { plannedOutcome, t, windowId, measurement, confidence } from "../../outcomes/domain/outcome.test-support";
import { InMemoryOutcomeRepository } from "../../outcomes/infrastructure";
import { createDecisionOutcomeAssessmentId, DEFAULT_DECISION_OUTCOME_POLICY } from "../domain";
import { InMemoryDecisionOutcomeAssessmentRepository, OutcomeRepositoryDecisionOutcomeReader } from "../infrastructure";
import type { DecisionOutcomeAuthorization } from "./contracts";
import { evaluateDecisionOutcomeService } from "./evaluate-decision-outcome-service";

const allow: DecisionOutcomeAuthorization = { canEvaluateOutcome: async () => true, canReadAssessment: async () => true };
function completedOutcome() {
  const outcome = plannedOutcome();
  outcome.startMeasurement({ occurredAt: t(2), idempotencyKey: "start" });
  outcome.recordMeasurement(measurement(), { occurredAt: t(6), idempotencyKey: "record" });
  outcome.closeWindow(windowId, { occurredAt: t(10), idempotencyKey: "window" });
  outcome.completeMeasurement({ occurredAt: t(11), idempotencyKey: "complete" });
  outcome.updateAttribution({ status: "supported", basis: [{ type: "before-after-comparison", evidence: [] }], competingFactors: [], confidence: confidence() }, { occurredAt: t(11), idempotencyKey: "attribution" });
  outcome.close({ occurredAt: t(12), idempotencyKey: "close" });
  return outcome;
}
const command = () => ({
  ownerId: createOutcomeOwnerId("owner-1"), outcomeId: plannedOutcome().id,
  assessmentId: createDecisionOutcomeAssessmentId("assessment-1"),
  policy: DEFAULT_DECISION_OUTCOME_POLICY, evaluatedAt: t(13), eventId: "evaluation-event-1",
  expectedAssessmentVersion: null,
});

describe("LI-002 evaluation application service", () => {
  it("authorizes before reading Outcome state", async () => {
    const outcomes = { getOutcome: vi.fn(async () => Result.ok(null)) };
    const denied: DecisionOutcomeAuthorization = { ...allow, canEvaluateOutcome: async () => false };
    const result = await evaluateDecisionOutcomeService({
      outcomes, assessments: new InMemoryDecisionOutcomeAssessmentRepository(), authorization: denied,
    }, command());
    expect(result).toMatchObject({ isFailure: true, error: { code: "ASSESSMENT_NOT_AUTHORIZED" } });
    expect(outcomes.getOutcome).not.toHaveBeenCalled();
  });

  it("loads an owner-scoped Outcome, evaluates it, and saves the assessment", async () => {
    const outcomes = new InMemoryOutcomeRepository(), assessments = new InMemoryDecisionOutcomeAssessmentRepository();
    const outcome = completedOutcome();
    await outcomes.save(outcome, null);
    const result = await evaluateDecisionOutcomeService({
      outcomes: new OutcomeRepositoryDecisionOutcomeReader(outcomes), assessments, authorization: allow,
    }, command());
    expect(result.isSuccess && result.value.classification).toBe("successful");
    const stored = await assessments.findById(outcome.ownerId, command().assessmentId);
    expect(stored.isSuccess && stored.value?.policyVersion).toBe(DEFAULT_DECISION_OUTCOME_POLICY.version);
  });

  it("conceals cross-owner Outcome reads as not found", async () => {
    const outcomes = new InMemoryOutcomeRepository(), assessments = new InMemoryDecisionOutcomeAssessmentRepository();
    await outcomes.save(completedOutcome(), null);
    const result = await evaluateDecisionOutcomeService({
      outcomes: new OutcomeRepositoryDecisionOutcomeReader(outcomes), assessments, authorization: allow,
    }, { ...command(), ownerId: createOutcomeOwnerId("other") });
    expect(result).toMatchObject({ isFailure: true, error: { code: "OUTCOME_NOT_FOUND" } });
  });

  it("optimistically versions reevaluations and rejects stale writes", async () => {
    const outcomes = new InMemoryOutcomeRepository(), assessments = new InMemoryDecisionOutcomeAssessmentRepository();
    await outcomes.save(completedOutcome(), null);
    const dependencies = { outcomes: new OutcomeRepositoryDecisionOutcomeReader(outcomes), assessments, authorization: allow };
    expect((await evaluateDecisionOutcomeService(dependencies, command())).isSuccess).toBe(true);
    const stale = await evaluateDecisionOutcomeService(dependencies, { ...command(), assessmentId: createDecisionOutcomeAssessmentId("assessment-2") });
    expect(stale).toMatchObject({ isFailure: true, error: { code: "ASSESSMENT_VERSION_CONFLICT", currentVersion: 1 } });
    const updated = await evaluateDecisionOutcomeService(dependencies, {
      ...command(), assessmentId: createDecisionOutcomeAssessmentId("assessment-2"),
      eventId: "evaluation-event-2", expectedAssessmentVersion: 1, evaluatedAt: t(14),
    });
    expect(updated.isSuccess && updated.value.version).toBe(2);
  });
});
