import { Action, ActionCollection, createActionId, type LegacyActionStatus as ActionStatus } from "../actions";
import { createWorkflowDefinitionId, createWorkflowStepId, WorkflowDefinition } from "./domain";

export function actions(status: ActionStatus = "accepted"): ActionCollection {
  return ActionCollection.create([
    Action.create({
      id: createActionId("action-review"), title: "Review", summary: "Review inputs.", type: "review",
      priority: "high", status, owner: { type: "team", id: "ops", displayName: "Ops" },
      decisionIds: [], createdAt: new Date("2026-07-19T12:00:00Z"),
      ...(status === "completed" || status === "measured" ? { completedAt: new Date("2026-07-19T13:00:00Z"), outcome: { summary: "Reviewed.", successful: true } } : {}),
    }),
    Action.create({
      id: createActionId("action-publish"), title: "Publish", summary: "Publish result.", type: "publish",
      priority: "medium", status: "accepted", owner: { type: "team", id: "ops", displayName: "Ops" },
      decisionIds: [], createdAt: new Date("2026-07-19T12:00:00Z"),
    }),
  ]);
}

export function definition() {
  const review = createWorkflowStepId("review");
  return WorkflowDefinition.create({
    id: createWorkflowDefinitionId("review-and-publish"),
    title: "Review and Publish",
    description: "Review work before publishing it.",
    steps: [
      { id: createWorkflowStepId("publish"), title: "Publish", description: "Publish result.", order: 2, requiredActionTypes: ["publish"], dependencyIds: [review] },
      { id: review, title: "Review", description: "Review inputs.", order: 1, requiredActionTypes: ["review"] },
    ],
  });
}
