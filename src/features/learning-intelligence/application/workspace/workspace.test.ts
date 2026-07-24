import { describe, expect, it, vi } from "vitest";
import { ConfidenceAssessment, ConfidenceScore } from "@/platform/scoring";
import type { DecisionOutcomeAssessment } from "../../decision-outcomes";
import { buildContinuousImprovementWorkspace } from "./build-continuous-improvement-workspace";
import { createGetContinuousImprovementWorkspace } from "./get-continuous-improvement-workspace";
import type { GetContinuousImprovementWorkspaceQuery, LearningWorkspaceSources } from "./continuous-improvement-workspace";

const start = new Date("2026-01-01T00:00:00.000Z");
const end = new Date("2026-12-31T00:00:00.000Z");
const query: GetContinuousImprovementWorkspaceQuery = Object.freeze({ ownerId: "owner-1", portfolioId: "portfolio-1", observationWindow: Object.freeze({ start, end }) });
const portfolio = Object.freeze({ id: "portfolio-1", ownerId: "owner-1", name: "Luxe Haven Portfolio", version: 4, lifecycleStage: "operating" });
function confidence(score = 0.8) { return ConfidenceAssessment.create({ score: ConfidenceScore.create(score), rationale: ["test"] }); }
function assessment(classification: DecisionOutcomeAssessment["classification"], id: string): DecisionOutcomeAssessment {
  return Object.freeze({
    id, ownerId: "owner-1", outcomeId: `outcome-${id}`, outcomeVersion: 2, decisionReferences: Object.freeze([{ decisionId: `decision-${id}` }]),
    classification, objectives: Object.freeze([]), varianceSummary: Object.freeze({ calculated: 0, unavailable: 0, favorable: 0, unfavorable: 0 }),
    guardrails: Object.freeze({ total: 1, preserved: classification === "harmful" ? 0 : 1, violated: classification === "harmful" ? 1 : 0, unknown: 0, violatedExpectationIds: Object.freeze([]) }),
    unexpectedEffects: Object.freeze([]), harm: Object.freeze({ detected: classification === "harmful", material: classification === "harmful", categories: Object.freeze([]), triggeringObservationIds: Object.freeze([]), overrideApplied: classification === "harmful" }),
    attribution: Object.freeze({ status: "supported", basis: Object.freeze([]), competingFactors: Object.freeze([]), confidence: confidence() }),
    confidence: Object.freeze({ assessment: confidence(), measurementQuality: confidence(), evidenceQuality: confidence(), attributionQuality: confidence(), coverage: { value: 100 }, freshnessScore: 1, penalties: Object.freeze([]) }),
    evidence: Object.freeze({ sufficiency: "sufficient", referenceCount: 1, requiredCount: 1, satisfiedRequiredCount: 1, authoritativeMeasurementCount: 1, limitationCount: 0 }),
    learningReadiness: "ready", policyVersion: "DO-1.0", evaluatedAt: new Date(`2026-06-${id.padStart(2, "0")}T00:00:00.000Z`), version: 1, events: Object.freeze([]),
  } as unknown as DecisionOutcomeAssessment);
}
function sources(outcomes: readonly DecisionOutcomeAssessment[] = []): LearningWorkspaceSources {
  return Object.freeze({ portfolio, outcomes: Object.freeze(outcomes.map((item) => Object.freeze({ assessment: item, subject: `Property ${item.id}`, subjectType: "property", decision: `Decision ${item.id}` }))), plannedOutcomeCount: 0, measuringOutcomeCount: 0, recommendations: Object.freeze([]), learning: null, unavailableSections: Object.freeze([]) });
}

describe("Continuous Improvement workspace", () => {
  it("returns an intentional no-Outcomes state without a success rate", () => {
    const state = buildContinuousImprovementWorkspace(query, sources());
    expect(state.status).toBe("no-outcomes");
  });
  it("keeps inconclusive separate from unsuccessful and highlights harmful Outcomes", () => {
    const state = buildContinuousImprovementWorkspace(query, sources([assessment("successful", "1"), assessment("inconclusive", "2"), assessment("harmful", "3")]));
    expect(state.status).toBe("insufficient-evidence");
    if (!("workspace" in state) || state.status === "no-outcomes" || state.status === "measurement-in-progress") throw new Error("unexpected");
    expect(state.workspace.decisions.distribution.inconclusive.count).toBe(1);
    expect(state.workspace.decisions.distribution.unsuccessful.count).toBe(0);
    expect(state.workspace.attention.items[0]?.type).toBe("outcome");
  });
  it("enforces bounded recent Outcomes and deterministic ordering", () => {
    const many = Array.from({ length: 30 }, (_, index) => assessment("successful", String(index + 1)));
    const state = buildContinuousImprovementWorkspace({ ...query, outcomeLimit: 999 }, sources(many));
    if (state.status === "no-outcomes" || state.status === "measurement-in-progress") throw new Error("unexpected");
    expect(state.workspace.outcomes.recent).toHaveLength(25);
    expect(state.workspace.outcomes.recent[0]?.id).toBe("30");
  });
  it("authorizes before sensitive portfolio and fan-out reads", async () => {
    const portfolioRead = vi.fn();
    const execute = createGetContinuousImprovementWorkspace({
      authorization: { canRead: async () => "concealed" },
      portfolios: { read: portfolioRead }, outcomes: { read: vi.fn() }, recommendations: { read: vi.fn() }, learnings: { read: vi.fn() },
    });
    const result = await execute(query);
    expect(result.isFailure && result.error.code).toBe("LEARNING_WORKSPACE_NOT_AUTHORIZED");
    expect(portfolioRead).not.toHaveBeenCalled();
  });
  it("degrades optional source failures rather than fabricating data", async () => {
    const execute = createGetContinuousImprovementWorkspace({
      authorization: { canRead: async () => "authorized" }, portfolios: { read: async () => portfolio },
      outcomes: { read: async () => ({ items: [{ assessment: assessment("successful", "1"), subject: "Retreat", subjectType: "property", decision: "Pricing" }], planned: 0, measuring: 0 }) },
      recommendations: { read: async () => { throw new Error("offline"); } }, learnings: { read: async () => null },
    });
    const result = await execute(query);
    expect(result.isSuccess && result.value.status).toBe("degraded");
    if (result.isSuccess && result.value.status === "degraded") expect(result.value.unavailableSections).toContain("recommendations");
  });
});
