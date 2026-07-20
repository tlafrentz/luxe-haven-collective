import { describe, expect, it } from "vitest";
import { ActionCollection } from "../../actions";
import { createWorkflowDefinitionId, WorkflowDefinition } from "../domain";
import { actions, definition } from "../workflow-fixtures.test-support";
import { WorkflowBuildError, WorkflowBuilder } from "./workflow-builder";

describe("WorkflowBuilder", () => {
  it("resolves actions, orders steps, dependencies, progress, and current step", () => {
    const workflow = new WorkflowBuilder().build({ definition: definition(), actions: actions(), createdAt: new Date("2026-07-19T14:00:00Z") });
    expect(workflow.steps.map((step) => step.id.value)).toEqual(["review", "publish"]);
    expect(workflow.steps[1].dependsOn(workflow.steps[0].id)).toBe(true);
    expect(workflow.currentStep?.id.value).toBe("review");
    expect(workflow.status).toBe("ready");
    expect(workflow.progress).toEqual({ completedSteps: 0, totalSteps: 2, percentComplete: 0 });
    expect(workflow.history).toHaveLength(1);
  });

  it("advances past completed dependencies", () => {
    const workflow = new WorkflowBuilder().build({ definition: definition(), actions: actions("completed"), createdAt: new Date() });
    expect(workflow.currentStep?.id.value).toBe("publish");
    expect(workflow.progress.completedSteps).toBe(1);
  });

  it("supports empty completed workflows", () => {
    const empty = WorkflowDefinition.create({ id: createWorkflowDefinitionId("empty"), title: "Empty", description: "No steps", steps: [] });
    const workflow = new WorkflowBuilder().build({ definition: empty, actions: ActionCollection.empty(), createdAt: new Date() });
    expect(workflow.status).toBe("completed");
    expect(workflow.currentStep).toBeUndefined();
    expect(workflow.progress.percentComplete).toBe(100);
  });

  it("reports missing required Action types", () => {
    expect(() => new WorkflowBuilder().build({ definition: definition(), actions: ActionCollection.empty(), createdAt: new Date() }))
      .toThrow(WorkflowBuildError);
  });
});
