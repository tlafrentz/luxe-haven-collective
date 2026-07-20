import { Action, ActionCollection, createActionId } from "../actions";
import { Identifier } from "../kernel";
import { createWorkflowId, createWorkflowStepId, Workflow, WorkflowCollection, WorkflowStep } from "../workflows";
import { AutomationBuilder, type AutomationRuleBuilderInput } from "./application";
import { AutomationCollection, createAutomationRuleId, type PlatformEvent } from "./domain";

export const event: PlatformEvent = { type: "decision-created", name: "approved", occurredAt: new Date("2026-07-19T14:00:00Z"), data: { confidence: 0.9, environment: "production" } };

export function action(id = "action-1", status: "proposed" | "accepted" = "accepted") {
  return Action.create({ id: createActionId(id), title: "Publish result", summary: "Publish approved work.", type: "publish", priority: "high", status,
    owner: { type: "automation", id: "platform", displayName: "Platform" }, decisionIds: [Identifier.create(`decision-${id}`)], createdAt: new Date("2026-07-19T12:00:00Z"),
    ...(status === "accepted" ? { acceptedAt: new Date("2026-07-19T13:00:00Z") } : {}),
  });
}
export function actionCollection(count = 1) { return ActionCollection.create(Array.from({ length: count }, (_, index) => action(`action-${index + 1}`))); }
export function workflow() {
  const stepId = createWorkflowStepId("publish");
  return Workflow.create({ id: createWorkflowId("workflow-1"), definitionId: Identifier.create("definition-1"), title: "Publish workflow", description: "Coordinate publishing.",
    status: "ready", currentStepId: stepId,
    steps: [WorkflowStep.create({ id: stepId, title: "Publish", description: "Publish work.", order: 1, actions: ActionCollection.create([action()]), requiredActionTypes: ["publish"], completionCriterion: "all-actions-completed" })],
    history: [{ status: "ready", recordedAt: new Date("2026-07-19T13:00:00Z") }],
  });
}
export function workflowCollection() { return WorkflowCollection.create([workflow()]); }
export function rule(overrides: Partial<AutomationRuleBuilderInput> = {}) {
  return new AutomationBuilder().buildRule({ id: createAutomationRuleId("rule-1"), title: "Start publishing", description: "Start approved work.",
    trigger: { type: "decision-created", eventName: "approved" }, target: { type: "action", id: createActionId("action-1") },
    ...overrides,
  });
}
export function rules(...values: ReturnType<typeof rule>[]) { return AutomationCollection.create(values); }
