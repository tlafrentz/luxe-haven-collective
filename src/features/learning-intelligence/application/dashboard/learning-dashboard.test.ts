import { describe, expect, it } from "vitest";
import { Result } from "@/platform/kernel";
import type { ContinuousImprovementWorkspace, ContinuousImprovementWorkspaceState, LearningWorkspaceLearningItem } from "../workspace";
import { buildLearningIntelligenceDashboard } from "./build-learning-intelligence-dashboard";
import { createGetLearningDashboard } from "./get-learning-dashboard";

const window = Object.freeze({ start: new Date("2026-01-01T00:00:00.000Z"), end: new Date("2026-12-31T00:00:00.000Z") });
function learning(overrides: Partial<LearningWorkspaceLearningItem> = {}): LearningWorkspaceLearningItem {
  return Object.freeze({
    id: "learning-1", statementCode: "DECISION_TYPE_SUCCESS_REPEATABLE", statement: "Renovation decisions repeatedly improve NOI.",
    category: "investment", type: "successful-pattern", maturity: "validated", status: "active", priority: "high",
    materiality: "material", confidence: 0.9, supportingCount: 12, contradictingCount: 1, contradiction: "minor",
    applicability: "broad", conditions: Object.freeze([]), consistency: "high", freshness: "current", scope: "portfolio", typicalEffect: null, ...overrides,
  });
}
function workspace(items: readonly LearningWorkspaceLearningItem[] = [learning()]): ContinuousImprovementWorkspace {
  return Object.freeze({
    portfolio: Object.freeze({ id: "portfolio-1", name: "Luxe Haven", version: 5, lifecycleStage: "operating" }), observationWindow: window, evaluatedAt: window.end,
    executiveSummary: Object.freeze({ decisionOutcomeStatus: "75% beneficial", recommendationStatus: "effective", strongestLearning: items[0] ?? null, largestRecurringMiss: null, measurementReadiness: Object.freeze({ status: "strong", completedOutcomeCoverage: 100, inconclusiveRate: 5 }), confidence: 0.88 }),
    outcomes: Object.freeze({ completedCount: 20, measuringCount: 1, plannedCount: 1, recent: Object.freeze([]) }),
    decisions: Object.freeze({ distribution: Object.freeze({ successful: Object.freeze({ count: 10, percentage: 50 }), "partially-successful": Object.freeze({ count: 5, percentage: 25 }), unsuccessful: Object.freeze({ count: 2, percentage: 10 }), harmful: Object.freeze({ count: 1, percentage: 5 }), inconclusive: Object.freeze({ count: 2, percentage: 10 }) }), averageConfidence: 0.82, observationWindow: window }),
    recommendations: Object.freeze({ items: Object.freeze([{ id: "rec-1", recommendationType: "weekend-pricing", effectiveness: "effective", quality: "validated", sampleSize: 12, successRate: 75, harmRate: 2, repeatability: "high", confidence: 0.85, trend: "improving", applicability: Object.freeze([]), learningReadiness: "ready", severeHarm: false }]) }),
    learnings: Object.freeze({ items: Object.freeze(items), candidateCount: 0, activeCount: items.length }),
    assumptionAccuracy: Object.freeze(items.filter((item) => item.type === "assumption-bias")), executionPatterns: Object.freeze([]),
    measurementQuality: Object.freeze({ readiness: Object.freeze({ status: "strong", completedOutcomeCoverage: 100, inconclusiveRate: 5 }), items: Object.freeze([]) }),
    changes: Object.freeze({ comparable: true, items: Object.freeze([{ id: "change-1", type: "portfolio-learning" as const, direction: "positive" as const, changeCode: "strengthened", label: "Learning strengthened." }]) }),
    attention: Object.freeze({ items: Object.freeze([{ rank: 1, type: "outcome" as const, severity: "critical" as const, sourceId: "harm-1", label: "Harmful Outcome requires review." }]) }),
    freshness: Object.freeze({ status: "current", reasons: Object.freeze([]) }), lineage: Object.freeze({ decisionPolicyVersions: Object.freeze(["DO-1"]), recommendationPolicyVersions: Object.freeze(["RE-1"]), learningPolicyVersion: "PL-1", portfolioVersion: 5 }),
    capabilities: Object.freeze({ viewOutcomes: "available", viewDecisionAssessments: "available", viewRecommendationEffectiveness: "available", viewPortfolioLearnings: "available", refreshLearning: "deferred", createOutcome: "deferred", recordMeasurement: "deferred", reviewLearning: "deferred", applyLearning: "unavailable", createAction: "unavailable" }),
    limitations: Object.freeze([]),
  });
}
function ready(source = workspace()): ContinuousImprovementWorkspaceState { return Object.freeze({ status: "ready", workspace: source }); }

describe("Learning Intelligence dashboard", () => {
  it("derives strong Learning Health in the application layer", () => {
    const second = learning({ id: "learning-2", statement: "Pricing decisions are repeatable." });
    const dashboard = buildLearningIntelligenceDashboard(ready(workspace([learning(), second])));
    expect(dashboard.status).toBe("ready");
    if ("dashboard" in dashboard) expect(dashboard.dashboard.executiveSummary.learningHealth).toBe("strong");
  });
  it("bounds strongest learnings, recurring misses, changes, and attention", () => {
    const items = Array.from({ length: 20 }, (_, index) => learning({ id: `learning-${index}`, statement: `Learning ${index}`, type: index % 2 ? "failure-pattern" : "successful-pattern" }));
    const source = workspace(items);
    const dashboard = buildLearningIntelligenceDashboard(ready({ ...source, changes: { comparable: true, items: Array.from({ length: 20 }, (_, index) => ({ id: String(index), type: "portfolio-learning", direction: "neutral", changeCode: "unchanged", label: "Unchanged" })) }, attention: { items: Array.from({ length: 20 }, (_, index) => ({ rank: index + 1, type: "learning", severity: "high", sourceId: String(index), label: "Review" })) } } as ContinuousImprovementWorkspace));
    if (!("dashboard" in dashboard)) throw new Error("expected dashboard");
    expect(dashboard.dashboard.learningSummary.strongest).toHaveLength(3);
    expect(dashboard.dashboard.learningSummary.recurringMisses).toHaveLength(3);
    expect(dashboard.dashboard.changes).toHaveLength(5);
    expect(dashboard.dashboard.attention).toHaveLength(5);
  });
  it("keeps assumption effect authoritative and does not recalculate variance", () => {
    const assumption = learning({ id: "bias", type: "assumption-bias", statementCode: "ASSUMPTIONS_SYSTEMATICALLY_OPTIMISTIC", typicalEffect: "-11%" });
    const dashboard = buildLearningIntelligenceDashboard(ready(workspace([assumption])));
    if (!("dashboard" in dashboard)) throw new Error("expected dashboard");
    expect(dashboard.dashboard.assumptions[0]).toMatchObject({ bias: "optimistic", effect: "-11%", trend: "not-comparable" });
  });
  it("preserves early states without creating Learning Health", () => {
    const state = buildLearningIntelligenceDashboard({ status: "no-outcomes", workspace: { portfolio: { id: "p", name: "P", version: 1, lifecycleStage: "formation" }, plannedCount: 2, measuringCount: 0, limitations: [] } });
    expect(state.status).toBe("no-outcomes");
    expect(state).not.toHaveProperty("dashboard");
  });
  it("uses one owner-scoped workspace query and maps typed errors", async () => {
    let calls = 0;
    const get = createGetLearningDashboard(async (query) => { calls += 1; expect(query.ownerId).toBe("owner-1"); return Result.ok(ready()); });
    const result = await get({ ownerId: "owner-1", portfolioId: "portfolio-1", observationWindow: window });
    expect(result.isSuccess).toBe(true);
    expect(calls).toBe(1);
    const denied = await createGetLearningDashboard(async () => Result.fail({ code: "LEARNING_WORKSPACE_NOT_AUTHORIZED" as const }))({ ownerId: "owner-2", portfolioId: "portfolio-1", observationWindow: window });
    expect(denied.isFailure && denied.error.code).toBe("LEARNING_DASHBOARD_NOT_AUTHORIZED");
  });
});
