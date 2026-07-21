import { describe, expect, it } from "vitest";
import { Action, ActionCollection, createActionId } from "@/platform/actions";
import { ClaimCollection } from "@/platform/claims";
import { Decision, DecisionCollection } from "@/platform/decisions";
import { createEvaluationId, EvaluationCollection } from "@/platform/evaluations";
import { EvidenceCollection } from "@/platform/evidence";
import { IntelligenceCollection } from "@/platform/intelligence";
import { Identifier } from "@/platform/kernel";
import { LearningCollection } from "@/platform/learning";
import { ObservationCollection } from "@/platform/observations";
import { createOutcomeId, emptyOutcomeLineage, Outcome, OutcomeCollection } from "@/platform/outcomes";
import { Recommendation, RecommendationCollection, RecommendationPriority, createRecommendationId } from "@/platform/recommendations";
import { ConfidenceAssessment, ConfidenceScore, Score } from "@/platform/scoring";
import { buildHpmLifecycleProjection } from "@/features/hpm";

import { buildExecutiveIntelligenceView } from "./build-executive-intelligence-view";

const at = new Date("2026-07-20T12:00:00Z");
const confidence = ConfidenceAssessment.create({ score: ConfidenceScore.create(80), rationale: ["Supported."] });

function lifecycle() {
  const recommendation = Recommendation.create({ id: createRecommendationId("recommendation-risk"), summary: "Protect revenue",
    rationale: ["Payment is at risk."], priority: RecommendationPriority.HIGH, category: "revenue", confidence,
    evaluationIds: [createEvaluationId("evaluation-risk")], evidenceIds: [], claimIds: [], observationIds: [],
    metadata: { impactType: "revenue-at-risk", estimatedAmount: 500, detectedAt: at.toISOString() } });
  const awaiting = Decision.create({ id: Identifier.create("decision-awaiting"), type: "review", outcome: "review",
    context: { subjectType: "portfolio", subjectId: "portfolio", effectiveAt: at }, rationale: { summary: "Review evidence.", confidence },
    decidedAt: at, priority: RecommendationPriority.HIGH, metadata: { awaitingEvidence: true } });
  const active = Decision.create({ id: Identifier.create("decision-active"), type: "execute", outcome: "execute",
    context: { subjectType: "portfolio", subjectId: "portfolio", effectiveAt: at }, rationale: { summary: "Execute.", confidence },
    decidedAt: at, priority: RecommendationPriority.MEDIUM });
  const blocked = Action.create({ id: createActionId("action-blocked"), title: "Resolve blocker", summary: "Resolve it.", type: "operations",
    priority: "critical", status: "blocked", owner: { type: "team", id: "ops", displayName: "Operations" }, decisionIds: [active.id], createdAt: at });
  const outcome = Outcome.create({ id: createOutcomeId("outcome-1"), title: "Revenue protected", summary: "Revenue was protected.", type: "action",
    status: "completed", successful: true, startedAt: at, completedAt: new Date("2026-07-20T13:00:00Z"), metrics: { revenue: 500 },
    lineage: { ...emptyOutcomeLineage(), recommendationIds: [recommendation.id], decisionIds: [active.id], actionIds: [blocked.id] } });
  return buildHpmLifecycleProjection({ observations: ObservationCollection.empty(), evidence: EvidenceCollection.empty(), claims: ClaimCollection.empty(),
    evaluations: EvaluationCollection.empty(), recommendations: RecommendationCollection.create([recommendation]), decisions: DecisionCollection.create([awaiting, active]),
    actions: ActionCollection.create([blocked]), outcomes: OutcomeCollection.create([outcome]), intelligence: IntelligenceCollection.empty(), learning: LearningCollection.empty(),
    pillarScores: new Map([["revenue", Score.create(82)]]) }, { now: at });
}

describe("buildExecutiveIntelligenceView", () => {
  it("uses canonical health, attention, decisions, actions, outcomes, and lineage", () => {
    const view = buildExecutiveIntelligenceView(lifecycle());
    expect(view.health).toMatchObject({ score: 82, confidence: null, status: "healthy", availablePillars: 1, totalPillars: 7 });
    expect(view.attention.risks[0]).toMatchObject({ source: "recommendation", sourceId: "recommendation-risk", urgency: "high" });
    expect(view.decisions).toMatchObject({ active: 1, awaitingEvidence: 1, readyForReview: 1 });
    expect(view.execution).toMatchObject({ openActions: 1, blockedActions: 1, completedActions: 0 });
    expect(view.execution.highestPriorityAction?.decisionIds).toEqual(["decision-active"]);
    expect(view.outcomes).toMatchObject({ measuredOutcomes: 1, positiveOutcomes: 1, neutralOutcomes: 0, negativeOutcomes: 0, learningSummary: null });
    expect(view.outcomes.latestOutcome?.actionIds).toEqual(["action-blocked"]);
  });

  it("does not turn missing scores or providers into poor health or fabricated results", () => {
    const empty = buildHpmLifecycleProjection({ observations: ObservationCollection.empty(), evidence: EvidenceCollection.empty(), claims: ClaimCollection.empty(),
      evaluations: EvaluationCollection.empty(), recommendations: RecommendationCollection.empty(), decisions: DecisionCollection.empty(), actions: ActionCollection.empty(),
      outcomes: OutcomeCollection.empty(), intelligence: IntelligenceCollection.empty(), learning: LearningCollection.empty() }, { now: at });
    const view = buildExecutiveIntelligenceView(empty);
    expect(view.health).toMatchObject({ score: null, status: "unavailable", availablePillars: 0 });
    expect(view.health.summary).toContain("unavailable");
    expect(view.outcomes.measuredOutcomes).toBe(0);
    expect(view.outcomes.learningSummary).toBeNull();
    expect(view.dataQuality.gaps.map((value) => value.type)).toContain("absent-provider");
  });
});
