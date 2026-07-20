import { describe, expect, it } from "vitest";

import { Action, ActionCollection, createActionId } from "@/platform/actions";
import { ClaimCollection } from "@/platform/claims";
import { DecisionCollection } from "@/platform/decisions";
import { EvaluationCollection } from "@/platform/evaluations";
import { EvidenceCollection } from "@/platform/evidence";
import { IntelligenceCollection } from "@/platform/intelligence";
import { Identifier } from "@/platform/kernel";
import { LearningCollection } from "@/platform/learning";
import { Observation, ObservationCollection } from "@/platform/observations";
import { createOutcomeId, emptyOutcomeLineage, Outcome, OutcomeCollection } from "@/platform/outcomes";
import { RecommendationCollection } from "@/platform/recommendations";
import { Score } from "@/platform/scoring";

import type { HpmCanonicalInputs } from "../domain";
import { buildHpmLifecycleProjection } from "./build-hpm-lifecycle-projection";

function inputs(): HpmCanonicalInputs {
  const at = new Date("2026-07-19T12:00:00Z");
  const recommendationId = Identifier.create("recommendation-revenue-1");
  const decisionId = Identifier.create("decision-revenue-1");
  const action = Action.create({
    id: createActionId("action-revenue-1"), title: "Publish pricing", summary: "Publish approved pricing.",
    type: "pricing", priority: "high", owner: { type: "user", id: "operator", displayName: "Operator" },
    decisionIds: [decisionId], createdAt: at,
  }).accept(at).start(at).complete(at, { summary: "Pricing published.", successful: true });
  const lineage = emptyOutcomeLineage();
  const outcome = Outcome.create({
    id: createOutcomeId("outcome-revenue-1"), title: "Pricing performance measured", summary: "Revenue increased after pricing publication.",
    type: "action", status: "completed", successful: true, startedAt: at, completedAt: at,
    metrics: { revenueImpact: 700 },
    lineage: { ...lineage, recommendationIds: [recommendationId], decisionIds: [decisionId], actionIds: [action.id] },
  });
  return {
    observations: ObservationCollection.create([Observation.create({ type: "analytics.revenue", subject: { type: "property", id: "property-1" }, label: "Revenue", value: 10700, source: { type: "calculation", name: "analytics" }, observedAt: at, recordedAt: at })]),
    evidence: EvidenceCollection.empty(), claims: ClaimCollection.empty(), evaluations: EvaluationCollection.empty(),
    recommendations: RecommendationCollection.empty(), decisions: DecisionCollection.empty(),
    actions: ActionCollection.create([action]), outcomes: OutcomeCollection.create([outcome]),
    intelligence: IntelligenceCollection.empty(), learning: LearningCollection.empty(),
    pillarScores: new Map([["revenue", Score.create(82)], ["operations", Score.create(72)]]),
    executive: { leadingPriorityId: "priority-1", priorityCount: 1 },
    analytics: { generatedAt: at, metricCount: 8 },
  };
}

describe("buildHpmLifecycleProjection", () => {
  it("organizes canonical artifacts into See, Understand, Decide, Execute, and Learn", () => {
    const source = inputs();
    const projection = buildHpmLifecycleProjection(source, { now: new Date("2026-07-19T13:00:00Z") });
    expect(projection.see.observations).toBe(source.observations);
    expect(projection.understand.intelligence).toBe(source.intelligence);
    expect(projection.decide.recommendations).toBe(source.recommendations);
    expect(projection.execute.actions).toBe(source.actions);
    expect(projection.learn.measuredOutcomes.size).toBe(1);
    expect(projection.currentPriorityId).toBe("priority-1");
  });

  it("uses Platform Scoring mechanics while retaining HPM aggregation policy", () => {
    const projection = buildHpmLifecycleProjection(inputs());
    expect(projection.health.score?.value).toBe(77);
    expect(projection.health.breakdown?.components.map((value) => value.key)).toEqual(["revenue", "operations"]);
    expect(projection.health.dataCoverage).toBe(29);
    expect(projection.health.status).toBe("healthy");
  });

  it("preserves improvement lineage and never labels measurement as Learning", () => {
    const projection = buildHpmLifecycleProjection(inputs());
    expect(projection.cycles).toHaveLength(1);
    expect(projection.cycles[0].status).toBe("measured");
    expect(projection.cycles[0].hasCompleteExecutionLineage).toBe(true);
    expect(projection.cycles[0].learning).toEqual([]);
    expect(projection.dataGaps).toContain("No validated Learning artifacts are available; measured Outcomes are not labeled as Learning.");
    expect(projection.health.realizedImpact).toEqual({ revenueImpact: 700 });
  });

  it("returns unavailable health without inventing scores or improvement", () => {
    const source = inputs();
    const projection = buildHpmLifecycleProjection({ ...source, observations: ObservationCollection.empty(), outcomes: OutcomeCollection.empty(), actions: ActionCollection.empty(), pillarScores: new Map() });
    expect(projection.health.score).toBeNull();
    expect(projection.health.status).toBe("unavailable");
    expect(projection.health.improvementMomentum).toBeNull();
  });
});
