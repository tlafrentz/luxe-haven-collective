import { describe, expect, it } from "vitest";

import { createClaimId } from "../claims";
import { createEvaluationId } from "../evaluations";
import { createEvidenceId } from "../evidence";
import { ExecutionStatus } from "../execution";
import { Identifier } from "../kernel";
import { createObservationId } from "../observations";
import {
  Recommendation,
  RecommendationCollection,
  RecommendationPriority,
  createRecommendationId,
} from "../recommendations";
import {
  ConfidenceAssessment,
  ConfidenceLevel,
  ConfidenceScore,
} from "../scoring";
import {
  DecisionBuilder,
  DecisionCollection,
  DecisionExecutor,
  DecisionMode,
  DecisionPolicyRegistry,
  DecisionSession,
  type DecisionPolicy,
} from ".";

function confidence(score = 86): ConfidenceAssessment {
  return ConfidenceAssessment.create({
    score: ConfidenceScore.create(score),
    level: ConfidenceLevel.VERY_HIGH,
    rationale: ["Reasoning lineage is complete."],
  });
}

function recommendation(
  id: string,
  summary = "Increase weekday visibility.",
  priority = RecommendationPriority.HIGH,
): Recommendation {
  return Recommendation.create({
    id: createRecommendationId(id),
    summary,
    rationale: ["Weekday demand is below target."],
    category: "revenue.demand-action",
    priority,
    confidence: confidence(),
    evaluationIds: [createEvaluationId(`evaluation-${id}`)],
    claimIds: [createClaimId(`claim-${id}`)],
    evidenceIds: [createEvidenceId(`evidence-${id}`)],
    observationIds: [createObservationId(`observation-${id}`)],
  });
}

function approvingPolicy(selected: readonly Recommendation[]): DecisionPolicy {
  return {
    name: "approval-policy",
    version: "1",
    supports: ({ recommendations }) => recommendations.isNotEmpty,
    decide: () => ({
      title: "Approve weekday demand action",
      summary: "Proceed with the selected weekday action.",
      rationale: ["The recommendation is sufficiently supported."],
      category: "revenue.demand-decision",
      mode: DecisionMode.AUTOMATIC,
      selectedRecommendations: selected,
      ...(selected.length > 1 ? { confidence: confidence(78) } : {}),
    }),
  };
}

describe("PF-008 Decision", () => {
  it("builds a committed action and preserves complete reasoning lineage", () => {
    const selected = recommendation("recommendation-demand");
    const decision = DecisionBuilder.create().buildFromPolicy({
      id: Identifier.create("decision-demand"),
      decidedAt: new Date("2026-07-19T22:00:00.000Z"),
      result: {
        title: "Approve weekday demand action",
        summary: "Proceed with the selected weekday action.",
        rationale: ["The recommendation is sufficiently supported."],
        category: "revenue.demand-decision",
        mode: DecisionMode.HUMAN_APPROVED,
        selectedRecommendations: [selected],
      },
      metadata: { approvedBy: "operator-001" },
    });

    expect(decision.title).toBe("Approve weekday demand action");
    expect(decision.mode).toBe(DecisionMode.HUMAN_APPROVED);
    expect(decision.priority).toBe(RecommendationPriority.HIGH);
    expect(decision.confidence.score.value).toBe(86);
    expect(decision.recommendationIds.map((id) => id.value)).toEqual(["recommendation-demand"]);
    expect(decision.evaluationIds.map((id) => id.value)).toEqual([
      "evaluation-recommendation-demand",
    ]);
    expect(decision.claimIds.map((id) => id.value)).toEqual(["claim-recommendation-demand"]);
    expect(decision.evidenceIds.map((id) => id.value)).toEqual([
      "evidence-recommendation-demand",
    ]);
    expect(decision.observationIds.map((id) => id.value)).toEqual([
      "observation-recommendation-demand",
    ]);
    expect(decision.metadata).toEqual({ approvedBy: "operator-001" });
    expect(decision.decidedAt.toISOString()).toBe("2026-07-19T22:00:00.000Z");
  });

  it("requires confidence when combining conflicting Recommendations", () => {
    const first = recommendation("recommendation-increase", "Increase price.");
    const second = recommendation("recommendation-decrease", "Decrease price.");
    expect(() => DecisionBuilder.create().buildFromPolicy({
      decidedAt: new Date(),
      result: {
        title: "Resolve price conflict",
        summary: "Select an action.",
        rationale: ["Recommendations conflict."],
        category: "revenue.price-decision",
        mode: DecisionMode.HUMAN_MODIFIED,
        selectedRecommendations: [first, second],
      },
    })).toThrow("Decision confidence is required when multiple Recommendations are selected.");
  });

  it("rejects a policy result with no selected Recommendation", () => {
    expect(() => DecisionBuilder.create().buildFromPolicy({
      decidedAt: new Date(),
      result: {
        title: "Invalid",
        summary: "Invalid selection.",
        rationale: ["No selection."],
        category: "invalid",
        mode: DecisionMode.REJECTED,
        selectedRecommendations: [],
      },
    })).toThrow("Decision selected Recommendations cannot be empty.");
  });
});

describe("PF-008 DecisionCollection", () => {
  it("supports lookup, filters, lineage queries, grouping, sorting, and aggregation", () => {
    const lowRecommendation = recommendation(
      "recommendation-low",
      "Defer low-priority action.",
      RecommendationPriority.LOW,
    );
    const highRecommendation = recommendation("recommendation-high");
    const builder = DecisionBuilder.create();
    const low = builder.buildFromPolicy({
      id: Identifier.create("decision-low"),
      decidedAt: new Date("2026-07-19T21:00:00.000Z"),
      result: {
        title: "Defer action",
        summary: "Wait.",
        rationale: ["Priority is low."],
        category: "revenue",
        mode: DecisionMode.DEFERRED,
        selectedRecommendations: [lowRecommendation],
      },
    });
    const high = builder.buildFromPolicy({
      id: Identifier.create("decision-high"),
      decidedAt: new Date("2026-07-19T22:00:00.000Z"),
      result: {
        title: "Approve action",
        summary: "Proceed.",
        rationale: ["Priority is high."],
        category: "revenue",
        mode: DecisionMode.AUTOMATIC,
        selectedRecommendations: [highRecommendation],
      },
    });
    const values = DecisionCollection.create([low, high]);

    expect(values.require(high.id)).toBe(high);
    expect(values.ofMode(DecisionMode.DEFERRED).size).toBe(1);
    expect(values.ofPriority(RecommendationPriority.HIGH).size).toBe(1);
    expect(values.selectingRecommendation(highRecommendation.id).size).toBe(1);
    expect(values.tracingObservation(highRecommendation.observationIds[0]).size).toBe(1);
    expect(values.priorityFirst().toArray()[0]).toBe(high);
    expect(values.newestFirst().toArray()[0]).toBe(high);
    expect(values.groupByMode().get(DecisionMode.AUTOMATIC)?.size).toBe(1);
    expect(values.countByMode().get(DecisionMode.DEFERRED)).toBe(1);
    expect([...values]).toEqual([low, high]);
  });
});

describe("PF-008 policies and execution", () => {
  it("registers, resolves, and validates Decision policies", () => {
    const selected = recommendation("recommendation-demand");
    const registry = DecisionPolicyRegistry.empty().register(approvingPolicy([selected]));
    expect(registry.require("approval-policy").version).toBe("1");
    expect([...registry]).toHaveLength(1);
    expect(() => DecisionPolicyRegistry.create([
      approvingPolicy([selected]),
      approvingPolicy([selected]),
    ])).toThrow("Decision policy names must be unique.");
  });

  it("orchestrates policy decisions and creates a session", async () => {
    const selected = recommendation("recommendation-demand");
    const moments = [
      new Date("2026-07-19T22:00:00.000Z"),
      new Date("2026-07-19T22:00:01.000Z"),
      new Date("2026-07-19T22:00:02.000Z"),
    ];
    const session = await new DecisionExecutor().execute({
      recommendations: RecommendationCollection.create([selected]),
      registry: DecisionPolicyRegistry.create([approvingPolicy([selected])]),
      now: () => moments.shift()!,
      createDecisionId: () => Identifier.create("decision-executed"),
      metadata: { run: "daily" },
    });

    expect(session.status).toBe(ExecutionStatus.COMPLETED);
    expect(session.decisions.size).toBe(1);
    expect(session.statistics).toMatchObject({ processed: 1, succeeded: 1, durationMs: 2000 });
    expect(session.decisions.toArray()[0].metadata).toEqual({
      policy: "approval-policy",
      policyVersion: "1",
    });
  });

  it("handles empty collections and captures policy failures", async () => {
    const failing: DecisionPolicy = {
      name: "failing-policy",
      supports: () => true,
      decide: () => { throw new Error("Conflict could not be resolved."); },
    };
    const session = await new DecisionExecutor(
      DecisionPolicyRegistry.create([failing]),
    ).execute({ recommendations: RecommendationCollection.empty() });

    expect(session.status).toBe(ExecutionStatus.FAILED);
    expect(session.decisions.isEmpty).toBe(true);
    expect(session.statistics).toMatchObject({ processed: 1, failed: 1 });
    expect(session.diagnostics.errors[0]).toContain("Conflict could not be resolved.");

    const empty = await new DecisionExecutor(DecisionPolicyRegistry.empty()).execute({
      recommendations: RecommendationCollection.empty(),
    });
    expect(empty.status).toBe(ExecutionStatus.COMPLETED);
    expect(empty.statistics.processed).toBe(0);
  });
});

describe("PF-008 DecisionSession", () => {
  it("validates execution accounting", () => {
    expect(() => DecisionSession.create({
      decisions: DecisionCollection.empty(),
      status: ExecutionStatus.COMPLETED,
      statistics: {
        startedAt: new Date(),
        processed: 1,
        succeeded: 1,
        skipped: 0,
        failed: 0,
      },
      diagnostics: { warnings: [], errors: [], skippedItems: [], exceptions: [] },
    })).toThrow("Successful Decision count must equal collection size.");
  });
});
