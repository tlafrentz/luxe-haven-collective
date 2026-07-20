import { describe, expect, it } from "vitest";
import { Action, createActionId } from "@/platform/actions";
import { createOutcomeId, emptyOutcomeLineage, Outcome } from "@/platform/outcomes";
import { buildActionCenterView } from "./build-action-center-view";

describe("Action Center Platform adapter", () => {
  it("projects measured Outcomes without treating them as Learning", () => {
    const action = Action.create({ id: createActionId("action-1"), title: "Publish rate", summary: "Publish it.", type: "pricing", priority: "high", status: "completed",
      owner: { type: "user", id: "user-1", displayName: "Todd" }, decisionIds: [], createdAt: new Date("2026-07-19T10:00:00Z"), completedAt: new Date("2026-07-19T10:20:00Z"),
      outcome: { summary: "Published.", successful: true }, metadata: { legacyPropertyId: "property-1" } });
    const lineage = emptyOutcomeLineage();
    const outcome = Outcome.create({ id: createOutcomeId("outcome-1"), title: "Measured", summary: "Revenue increased.", type: "action", status: "completed", successful: true,
      startedAt: new Date("2026-07-19T10:00:00Z"), completedAt: new Date("2026-07-19T11:00:00Z"), lineage: { ...lineage, actionIds: [action.id] }, metrics: { revenue: 125 } });

    const view = buildActionCenterView([{ action, outcome }]);
    expect(view.recentlyMeasured).toHaveLength(1);
    expect(view.recentlyCompleted).toHaveLength(0);
    expect(view.summary).toMatchObject({ completed: 1, measured: 1 });
  });
});
