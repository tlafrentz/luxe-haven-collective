import { describe, expect, it } from "vitest";
import {
  PlatformAction,
  createActionId,
  createWorkspaceId,
  type ActionActor,
} from "../domain";
import { projectExecuteActionDetail } from "./execute-action-detail";
import type {
  ExecuteControlAuthorization,
  ExecuteControlState,
} from "./execute-controls";

const actor: ActionActor = { type: "user", id: "owner" },
  at = new Date("2026-08-09T12:00:00Z");
function action() {
  let value = PlatformAction.createCommitted({
    id: createActionId("a"),
    workspaceId: createWorkspaceId("w"),
    title: "Inspect room",
    priority: "high",
    owner: actor,
    sources: [
      {
        type: "decision",
        sourceId: "decision-1",
        recordedAt: at,
        recordedBy: actor,
      },
    ],
    createdAt: at,
    createdBy: actor,
  });
  const context = () => ({
    workspaceId: value.workspaceId,
    expectedVersion: value.version,
    actor,
    occurredAt: at,
  });
  value = value.assign({
    ...context(),
    assigneeType: "user",
    assigneeId: "owner",
  });
  return value.markReady(context());
}
const authorization: ExecuteControlAuthorization = {
  canWork: async () => true,
  canReview: async () => true,
  canManage: async () => true,
  canAccessDependency: async () => true,
};
describe("EX-001B2 Action detail projection", () => {
  it("projects context, immutable controls, and only valid next commands", async () => {
    const current = action();
    const state: ExecuteControlState = {
      action: current,
      evidencePolicy: {
        mode: "specific",
        requiredTypes: ["photo"],
        reviewRequired: true,
      },
      evidence: [],
      blockers: [],
      dependencies: [],
      relatedActions: [current],
      completionCriteria: ["Room photographed"],
      propertyId: "property-1",
      planId: "plan-1",
      expectedOutcome: "Room accepted",
      successMetric: "Zero punch-list items",
    };
    const detail = await projectExecuteActionDetail({
      state,
      activity: [],
      actor,
      authorization,
    });
    expect(detail).toMatchObject({
      decisionId: "decision-1",
      propertyId: "property-1",
      planId: "plan-1",
      completionChecklist: ["Room photographed"],
    });
    expect(detail.validCommands).toContain("start");
    expect(detail.validCommands).not.toContain("complete");
    expect(Object.isFrozen(detail.validCommands)).toBe(true);
  });
});
