import { describe, expect, it } from "vitest";

import { createClaimId } from "../claims";
import {
  Evaluation,
  EvaluationCollection,
  EvaluationDisposition,
  createEvaluationId,
} from "../evaluations";
import { createEvidenceId } from "../evidence";
import {
  ExecutionStatus,
} from "../execution";
import {
  ConfidenceAssessment,
  ConfidenceLevel,
  ConfidenceScore,
} from "../scoring";
import {
  Recommendation,
  RecommendationBuilder,
  RecommendationCollection,
  RecommendationExecutor,
  RecommendationPolicyRegistry,
  RecommendationPriority,
  RecommendationSession,
  createRecommendationId,
  type RecommendationPolicy,
} from ".";

const evidenceId = createEvidenceId("evidence-demand");

function evaluation(id = "evaluation-demand"): Evaluation {
  return Evaluation.create({
    id: createEvaluationId(id),
    type: "revenue.demand",
    claimId: createClaimId("claim-demand"),
    disposition: EvaluationDisposition.SUPPORTED,
    summary: "Weekday demand is below target.",
    confidence: ConfidenceAssessment.create({
      score: ConfidenceScore.create(82),
      level: ConfidenceLevel.VERY_HIGH,
      rationale: ["Demand evidence is consistent."],
    }),
    evidenceIds: [evidenceId],
    source: { capability: "revenue-intelligence", name: "demand-evaluation" },
    evaluatedAt: new Date("2026-07-19T20:00:00.000Z"),
  });
}

function recommendation(
  id: string,
  priority = RecommendationPriority.HIGH,
): Recommendation {
  const supportingEvaluation = evaluation();
  return Recommendation.create({
    id: createRecommendationId(id),
    summary: "Introduce a weekday offer.",
    rationale: ["Weekday demand is below target."],
    category: "revenue.demand-action",
    priority,
    confidence: supportingEvaluation.confidence,
    evaluationIds: [supportingEvaluation.id],
    evidenceIds: supportingEvaluation.evidenceIds,
    metadata: { market: "Phoenix" },
  });
}

function policy(
  name = "weekday-demand-policy",
  supports = true,
): RecommendationPolicy {
  return {
    name,
    version: "1",
    supports: () => supports,
    recommend: ({ evaluations }) => {
      const supportingEvaluation = evaluations.toArray()[0];
      return {
        summary: "Introduce a weekday offer.",
        rationale: ["Weekday demand is below target."],
        category: "revenue.demand-action",
        priority: RecommendationPriority.HIGH,
        supportingEvaluations: [supportingEvaluation],
      };
    },
  };
}

describe("Recommendation", () => {
  it("creates an immutable action with confidence and traceability", () => {
    const value = recommendation("recommendation-demand");

    expect(value.summary).toBe("Introduce a weekday offer.");
    expect(value.confidence.score.value).toBe(82);
    expect(value.supportedByEvaluation(createEvaluationId("evaluation-demand"))).toBe(true);
    expect(value.supportedByEvidence(evidenceId)).toBe(true);
    expect(value.metadata).toEqual({ market: "Phoenix" });
  });

  it("validates required action content and supporting Evaluations", () => {
    const supportingEvaluation = evaluation();
    expect(() => Recommendation.create({
      summary: " ",
      rationale: ["Reason"],
      category: "revenue",
      priority: RecommendationPriority.HIGH,
      confidence: supportingEvaluation.confidence,
      evaluationIds: [supportingEvaluation.id],
    })).toThrow("Recommendation summary cannot be empty.");
    expect(() => Recommendation.create({
      summary: "Act",
      rationale: ["Reason"],
      category: "revenue",
      priority: RecommendationPriority.HIGH,
      confidence: supportingEvaluation.confidence,
      evaluationIds: [],
    })).toThrow("Recommendation supporting Evaluations cannot be empty.");
  });
});

describe("RecommendationCollection", () => {
  it("supports lookup, filtering, grouping, sorting, aggregation, and iteration", () => {
    const low = recommendation("recommendation-low", RecommendationPriority.LOW);
    const critical = recommendation("recommendation-critical", RecommendationPriority.CRITICAL);
    const values = RecommendationCollection.create([low, critical]);

    expect(values.require(low.id)).toBe(low);
    expect(values.ofPriority(RecommendationPriority.CRITICAL).size).toBe(1);
    expect(values.ofCategory("revenue.demand-action").size).toBe(2);
    expect(values.supportingEvidence(evidenceId).size).toBe(2);
    expect(values.priorityFirst().toArray()[0]).toBe(critical);
    expect(values.groupByPriority().get(RecommendationPriority.LOW)?.size).toBe(1);
    expect(values.countByPriority()[RecommendationPriority.HIGH]).toBe(0);
    expect([...values]).toEqual([low, critical]);
  });

  it("rejects duplicate identities", () => {
    const value = recommendation("recommendation-duplicate");
    expect(() => RecommendationCollection.create([value, value])).toThrow(
      "Recommendation IDs must be unique.",
    );
  });
});

describe("RecommendationBuilder", () => {
  it("inherits confidence and Evidence from one supporting Evaluation", () => {
    const supportingEvaluation = evaluation();
    const value = new RecommendationBuilder().build({
      id: createRecommendationId("recommendation-built"),
      result: {
        summary: "Introduce a weekday offer.",
        rationale: ["Demand is below target."],
        category: "revenue.demand-action",
        priority: RecommendationPriority.HIGH,
        supportingEvaluations: [supportingEvaluation],
      },
    });

    expect(value.confidence.score.value).toBe(82);
    expect(value.evidenceIds.map((id) => id.value)).toEqual(["evidence-demand"]);
  });

  it("requires explicit confidence for a multi-Evaluation recommendation", () => {
    expect(() => new RecommendationBuilder().build({
      result: {
        summary: "Coordinate action.",
        rationale: ["Multiple signals."],
        category: "portfolio.action",
        priority: RecommendationPriority.MEDIUM,
        supportingEvaluations: [evaluation("evaluation-one"), evaluation("evaluation-two")],
      },
    })).toThrow("Recommendation confidence is required when multiple Evaluations support it.");
  });
});

describe("RecommendationPolicyRegistry", () => {
  it("registers, looks up, and enumerates valid policies", () => {
    const registry = RecommendationPolicyRegistry.empty().register(policy());
    expect(registry.size).toBe(1);
    expect(registry.require("weekday-demand-policy").version).toBe("1");
    expect([...registry]).toHaveLength(1);
  });

  it("rejects duplicate and invalid policies", () => {
    expect(() => RecommendationPolicyRegistry.create([policy(), policy()])).toThrow(
      "Recommendation policy names must be unique.",
    );
    expect(() => RecommendationPolicyRegistry.create([{
      name: "invalid",
      supports: true,
      recommend: () => undefined,
    } as unknown as RecommendationPolicy])).toThrow(
      'Recommendation policy "invalid" is invalid.',
    );
  });
});

describe("RecommendationExecutor", () => {
  it("orchestrates applicable policies and creates an execution session", async () => {
    const moments = [
      new Date("2026-07-19T21:00:00.000Z"),
      new Date("2026-07-19T21:00:01.000Z"),
    ];
    const session = await new RecommendationExecutor().execute({
      evaluations: EvaluationCollection.create([evaluation()]),
      registry: RecommendationPolicyRegistry.create([policy()]),
      now: () => moments.shift()!,
      createRecommendationId: () => createRecommendationId("recommendation-executed"),
      metadata: { run: "daily" },
    });

    expect(session.status).toBe(ExecutionStatus.COMPLETED);
    expect(session.recommendations.size).toBe(1);
    expect(session.statistics).toMatchObject({ processed: 1, succeeded: 1, durationMs: 1000 });
    expect(session.recommendations.toArray()[0].metadata).toEqual({
      policy: "weekday-demand-policy",
      policyVersion: "1",
    });
    expect(session.metadata).toEqual({ run: "daily" });
  });

  it("handles empty Evaluations without side effects", async () => {
    const session = await new RecommendationExecutor(
      RecommendationPolicyRegistry.create([policy("not-applicable", false)]),
    ).execute({ evaluations: EvaluationCollection.empty() });

    expect(session.status).toBe(ExecutionStatus.COMPLETED);
    expect(session.recommendations.isEmpty).toBe(true);
    expect(session.statistics).toMatchObject({ processed: 1, skipped: 1, failed: 0 });
  });

  it("captures policy failures and continues executing", async () => {
    const failing: RecommendationPolicy = {
      name: "failing-policy",
      supports: () => true,
      recommend: () => { throw new Error("Policy failure."); },
    };
    const session = await new RecommendationExecutor(
      RecommendationPolicyRegistry.create([failing, policy()]),
    ).execute({
      evaluations: EvaluationCollection.create([evaluation()]),
      createRecommendationId: () => createRecommendationId("recommendation-success"),
    });

    expect(session.status).toBe(ExecutionStatus.COMPLETED_WITH_WARNINGS);
    expect(session.statistics).toMatchObject({ succeeded: 1, failed: 1 });
    expect(session.diagnostics.exceptions).toEqual(["failing-policy"]);
    expect(session.diagnostics.errors[0]).toContain("Policy failure.");
  });
});

describe("RecommendationSession", () => {
  it("validates execution accounting", () => {
    expect(() => RecommendationSession.create({
      recommendations: RecommendationCollection.empty(),
      status: ExecutionStatus.COMPLETED,
      statistics: {
        startedAt: new Date(),
        processed: 1,
        succeeded: 1,
        skipped: 0,
        failed: 0,
      },
      diagnostics: { warnings: [], errors: [], skippedItems: [], exceptions: [] },
    })).toThrow("Successful recommendation count must equal collection size.");
  });
});
