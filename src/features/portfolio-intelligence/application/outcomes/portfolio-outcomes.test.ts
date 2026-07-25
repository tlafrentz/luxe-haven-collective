import { describe, expect, it } from "vitest";
import {
  createDecisionOutcomeAssessmentId, DEFAULT_DECISION_OUTCOME_POLICY,
  evaluateDecisionOutcome,
} from "@/features/learning-intelligence/decision-outcomes";
import {
  confidence, measurement, plannedOutcome, t, windowId,
} from "@/features/learning-intelligence/outcomes/domain/outcome.test-support";
import { portfolioDecisionFixture } from "../decisions/portfolio-decisions.test";
import {
  buildPortfolioDecisionOutcomeReview, buildPortfolioOutcomesWorkspace,
  evaluateOutcomeReviewReadiness, generatePortfolioLearning,
} from "./build-outcomes";
import { knowledgeMaturity } from "./policies";
import { publishCanonicalPortfolioOutcomeReview } from "./services";
import { InMemoryPortfolioOutcomeRepository } from "../../infrastructure/in-memory-portfolio-outcome-repository";

function fixture() {
  const base = portfolioDecisionFixture();
  const decision = {
    ...base.decision, decisionId: "decision-1", canonicalDecisionId: "decision-1",
    status: "approved" as const, decidedAt: "2026-01-01T00:00:00Z",
    reviewAt: "2026-04-01T00:00:00Z",
  };
  const outcome = plannedOutcome();
  outcome.startMeasurement({ occurredAt: t(2), idempotencyKey: "start" });
  outcome.recordMeasurement(measurement(), { occurredAt: t(6), idempotencyKey: "record" });
  outcome.closeWindow(windowId, { occurredAt: t(10), idempotencyKey: "window" });
  outcome.completeMeasurement({ occurredAt: t(11), idempotencyKey: "complete" });
  outcome.updateAttribution({
    status: "supported", basis: [{ type: "before-after-comparison", evidence: [] }],
    competingFactors: [], confidence: confidence(),
  }, { occurredAt: t(11), idempotencyKey: "attribution" });
  outcome.close({ occurredAt: t(12), idempotencyKey: "close" });
  const assessment = evaluateDecisionOutcome({
    assessmentId: createDecisionOutcomeAssessmentId("portfolio-assessment-1"),
    outcome: outcome.props, policy: DEFAULT_DECISION_OUTCOME_POLICY,
    evaluatedAt: t(13), eventId: "portfolio-assessment-event",
  });
  const input = {
    workspaceId: "workspace-1", decision, assessment,
    assumptionReviews: decision.assumptions.map((assumption) => ({
      assumptionId: assumption.id, statement: assumption.statement,
      status: "confirmed" as const, evidence: base.findings.evidence,
      reviewedAt: "2026-04-02T00:00:00Z", notes: "Supported by current measured evidence.",
    })),
    lessons: {
      whatHappened: "ADR exceeded the approved expectation.",
      why: "The executed change and demand conditions supported the outcome.",
      surprise: "The improvement arrived earlier than expected.",
      futureGuidance: "Retain the measurement design for comparable decisions.",
    },
    reviewedByProfileId: "profile-owner", reviewedAt: "2026-04-02T00:00:00Z",
    evidence: base.findings.evidence,
  };
  return { ...base, decision, assessment, input };
}

describe("PI-001G portfolio outcomes and learning", () => {
  it("adapts canonical Decision Outcome assessments without recalculating variance", () => {
    const { assessment, input } = fixture();
    const review = buildPortfolioDecisionOutcomeReview(input);
    expect(review.success).toBe("exceeded-expectations");
    expect(review.metrics[0].variance).toBe(assessment.objectives[0].variance);
    expect(review).toMatchObject({ immutable: true, decisionEvidenceVersion: input.decision.evidenceVersion });
  });
  it("preserves baseline, expected, actual, variance, assumptions, lessons, and lineage", () => {
    const review = buildPortfolioDecisionOutcomeReview(fixture().input);
    expect(review.baseline[0]).toContain("Unavailable");
    expect(review.expected[0]).toContain("USD 210");
    expect(review.actual[0]).toContain("USD 220");
    expect(review.assumptions[0]).toMatchObject({ status: "confirmed" });
    expect(review.lessons.futureGuidance).toBeTruthy();
    expect(review.assessmentVersion).toBe(1);
  });
  it("requires approved execution, elapsed time, current evidence, and measurements", () => {
    const { decision } = fixture();
    expect(evaluateOutcomeReviewReadiness({
      decision, executionComplete: true, evidenceCount: 2, freshness: "current",
      now: "2026-04-02T00:00:00Z",
    }).state).toBe("ready");
    expect(evaluateOutcomeReviewReadiness({
      decision, executionComplete: false, evidenceCount: 2, freshness: "current",
      now: "2026-04-02T00:00:00Z",
    })).toMatchObject({ state: "not-ready", reasons: expect.arrayContaining(["Execution is not complete."]) });
    expect(evaluateOutcomeReviewReadiness({
      decision, executionComplete: true, evidenceCount: 0, freshness: "current",
      now: "2026-04-02T00:00:00Z",
    }).state).toBe("insufficient-evidence");
    expect(evaluateOutcomeReviewReadiness({
      decision, executionComplete: true, evidenceCount: 2, freshness: "degraded",
      now: "2026-04-02T00:00:00Z",
    }).state).toBe("degraded");
  });
  it("accumulates structured knowledge with evidence-based maturity", () => {
    const review = buildPortfolioDecisionOutcomeReview(fixture().input);
    expect(generatePortfolioLearning([review], "2026-04-02T00:00:00Z")[0]).toMatchObject({
      maturity: "emerging", derivedFromReviewIds: [review.id],
    });
    expect(knowledgeMaturity(3)).toBe("supported");
    expect(knowledgeMaturity(7)).toBe("established");
    expect(knowledgeMaturity(15)).toBe("well-validated");
  });
  it("tracks recommendation and strategy performance without rewriting recommendations", () => {
    const base = fixture();
    const review = buildPortfolioDecisionOutcomeReview(base.input);
    const workspace = buildPortfolioOutcomesWorkspace({
      decisions: [base.decision], candidates: [base.candidate], reviews: [review],
      readiness: [], role: "owner", evaluatedAt: "2026-04-02T00:00:00Z",
    });
    expect(workspace.recommendationPerformance).toMatchObject({ generated: 1, approved: 1, completed: 1, successful: 1 });
    expect(workspace.strategyEffectiveness[0]).toMatchObject({ reviewed: 1, exceeded: 1 });
    expect(base.candidate).not.toHaveProperty("success");
  });
  it("publishes immutable reviews idempotently and appends learning", async () => {
    const repository = new InMemoryPortfolioOutcomeRepository();
    const input = fixture().input;
    const first = await publishCanonicalPortfolioOutcomeReview({ repository, review: input, commandId: "review-command" });
    const replay = await publishCanonicalPortfolioOutcomeReview({ repository, review: input, commandId: "review-command" });
    expect(replay).toEqual(first);
    expect(await repository.listReviews("workspace-1")).toHaveLength(1);
    expect((await repository.listLearnings("workspace-1")).length).toBeGreaterThan(0);
  });
});

export { fixture as portfolioOutcomeFixture };

