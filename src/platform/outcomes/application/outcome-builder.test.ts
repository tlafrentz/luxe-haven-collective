import { describe, expect, it } from "vitest";
import { Identifier } from "../../kernel";
import { completedAction, lineage, successfulAutomation } from "../outcome-fixtures.test-support";
import { OutcomeBuilder, OutcomeTraceabilityError } from "./outcome-builder";

describe("OutcomeBuilder", () => {
  it("derives timing and execution lineage while preserving upstream reasoning lineage", () => {
    const value = new OutcomeBuilder().build({ source: { type: "action", action: completedAction() }, result: {
      title: "Action result", summary: "The Action completed.", status: "completed", successful: true,
      metrics: { revenueImpact: 100 }, lineage: lineage(),
    } });
    expect(value.durationMs).toBe(300_000);
    expect(value.metrics).toEqual({ durationMs: 300_000, revenueImpact: 100 });
    expect(value.lineage.actionIds.map((id) => id.value)).toEqual(["action-1"]);
    expect(value.lineage.decisionIds.map((id) => id.value)).toEqual(["decision-1"]);
    expect(value.traces(Identifier.create("recommendation-1"))).toBe(true);
  });

  it("applies policy timeout behavior", () => {
    const value = new OutcomeBuilder().build({ source: { type: "automation", automation: successfulAutomation() }, result: {
      title: "Timed execution", summary: "Execution exceeded its limit.", status: "completed", successful: true,
      timeoutMs: 60_000, lineage: lineage(),
    } });
    expect(value.status).toBe("timed-out"); expect(value.successful).toBe(false); expect(value.durationMs).toBe(1_200_000);
  });

  it("rejects Action-derived Outcomes with incomplete reasoning lineage", () => {
    expect(() => new OutcomeBuilder().build({ source: { type: "action", action: completedAction() }, result: {
      title: "Incomplete", summary: "Missing lineage.", status: "completed", successful: true,
      lineage: { automationExecutionIds: [], workflowIds: [], actionIds: [], decisionIds: [], recommendationIds: [], evaluationIds: [], claimIds: [], evidenceIds: [], observationIds: [] },
    } })).toThrow(OutcomeTraceabilityError);
  });
});
