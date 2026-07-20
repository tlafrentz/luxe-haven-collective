import { describe, expect, it } from "vitest";

import { Action, ActionCollection, createActionId } from "@/platform/actions";
import { DecisionCollection } from "@/platform/decisions";
import { IntelligenceCollection } from "@/platform/intelligence";
import { Identifier } from "@/platform/kernel";
import { OutcomeCollection } from "@/platform/outcomes";
import { Recommendation, RecommendationCollection, RecommendationPriority, createRecommendationId } from "@/platform/recommendations";
import { ConfidenceAssessment, ConfidenceLevel, ConfidenceScore } from "@/platform/scoring";

import { buildExecutiveProjection } from "./build-executive-projection";

const confidence = ConfidenceAssessment.create({ score: ConfidenceScore.create(80), level: ConfidenceLevel.HIGH, rationale: ["Canonical source confidence."] });

describe("buildExecutiveProjection", () => {
  it("prioritizes canonical inputs without re-evaluating their conclusions", () => {
    const recommendation = Recommendation.create({
      id: createRecommendationId("recommendation-revenue-weekend-pricing"),
      summary: "Raise weekend pricing",
      rationale: ["Revenue policy detected excess weekend demand."],
      priority: RecommendationPriority.HIGH,
      category: "revenue-pricing",
      confidence,
      evaluationIds: [Identifier.create("evaluation-revenue-1")],
      metadata: { estimatedAmount: 500 },
    });
    const action = Action.create({
      id: createActionId("action-review-insurance"),
      title: "Review insurance",
      summary: "Validate coverage.",
      type: "investment-diligence",
      priority: "medium",
      owner: { type: "user", id: "operator", displayName: "Operator" },
      decisionIds: [Identifier.create("decision-investment-1")],
      createdAt: new Date("2026-07-19T10:00:00Z"),
    });
    const projection = buildExecutiveProjection({
      recommendations: RecommendationCollection.create([recommendation]),
      decisions: DecisionCollection.empty(),
      actions: ActionCollection.create([action]),
      outcomes: OutcomeCollection.empty(),
      intelligence: IntelligenceCollection.empty(),
    }, { now: new Date("2026-07-19T12:00:00Z") });

    expect(projection.priorities[0].sourceId).toBe(recommendation.id.value);
    expect(projection.priorities[0].title).toBe(recommendation.summary);
    expect(projection.focusDecision?.recommendationIds).toEqual([recommendation.id]);
    expect(projection.briefing.recommendedFocus).toContain("Revenue policy");
  });

  it("produces an empty, stable briefing when no canonical records need attention", () => {
    const projection = buildExecutiveProjection({
      recommendations: RecommendationCollection.empty(),
      decisions: DecisionCollection.empty(),
      actions: ActionCollection.empty(),
      outcomes: OutcomeCollection.empty(),
      intelligence: IntelligenceCollection.empty(),
    }, { now: new Date("2026-07-19T12:00:00Z") });
    expect(projection.priorities).toEqual([]);
    expect(projection.focusDecision).toBeUndefined();
    expect(projection.health.overall).toBeNull();
  });
});
