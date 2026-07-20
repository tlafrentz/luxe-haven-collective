import { Action, ActionCollection, createActionId } from "../actions";
import { AutomationBuilder, AutomationHistory, createAutomationExecutionId, createAutomationRuleId } from "../automations";
import { Identifier } from "../kernel";
import { createWorkflowId, createWorkflowStepId, Workflow, WorkflowCollection, WorkflowStep } from "../workflows";
import type { OutcomeLineage } from "./domain";
import type { OutcomePolicy } from "./application";

const id = (value: string) => Identifier.create(value);
export function lineage(): OutcomeLineage {
  return { automationExecutionIds: [], workflowIds: [], actionIds: [], decisionIds: [],
    recommendationIds: [id("recommendation-1")], evaluationIds: [id("evaluation-1")], claimIds: [id("claim-1")],
    evidenceIds: [id("evidence-1")], observationIds: [id("observation-1")],
  };
}
export function completedAction() {
  return Action.create({ id: createActionId("action-1"), title: "Completed work", summary: "The work finished.", type: "operations", priority: "high", status: "completed",
    owner: { type: "team", id: "ops", displayName: "Operations" }, decisionIds: [id("decision-1")],
    createdAt: new Date("2026-07-19T10:00:00Z"), acceptedAt: new Date("2026-07-19T10:30:00Z"), startedAt: new Date("2026-07-19T11:00:00Z"), completedAt: new Date("2026-07-19T11:05:00Z"),
    outcome: { summary: "Finished.", successful: true },
  });
}
export function completedWorkflow() {
  const stepId = createWorkflowStepId("step-1"), action = completedAction();
  return Workflow.create({ id: createWorkflowId("workflow-1"), definitionId: id("definition-1"), title: "Completed workflow", description: "The process finished.", status: "completed",
    steps: [WorkflowStep.create({ id: stepId, title: "Work", description: "Complete work.", order: 1, actions: ActionCollection.create([action]), requiredActionTypes: [action.type], completionCriterion: "all-actions-completed" })],
    history: [{ status: "ready", recordedAt: new Date("2026-07-19T10:00:00Z") }, { status: "completed", recordedAt: new Date("2026-07-19T11:10:00Z") }],
  });
}
export function successfulAutomation() {
  return new AutomationBuilder().buildExecution({ id: createAutomationExecutionId("automation-1"), ruleId: createAutomationRuleId("rule-1"),
    trigger: { type: "decision-created", occurredAt: new Date("2026-07-19T10:45:00Z") }, startedAt: new Date("2026-07-19T10:45:00Z"), completedAt: new Date("2026-07-19T11:05:00Z"), status: "succeeded",
    executedActions: ActionCollection.create([completedAction()]), diagnostics: { warnings: [], errors: [], skippedItems: [], exceptions: [] }, outcome: { successful: true, attempts: 1, message: "Completed" },
  });
}
export const collections = {
  actions: () => ActionCollection.create([completedAction()]),
  workflows: () => WorkflowCollection.create([completedWorkflow()]),
  automations: () => AutomationHistory.create([successfulAutomation()]),
};
export const policy: OutcomePolicy = {
  name: "record-execution", supports: () => true,
  measure({ source }) {
    return { title: `${source.type} result`, summary: "Execution was recorded.", status: "completed", successful: true,
      metrics: { processed: 1 }, result: { recordsProcessed: 1 }, notes: ["Recorded without analysis."], lineage: lineage(),
    };
  },
};
