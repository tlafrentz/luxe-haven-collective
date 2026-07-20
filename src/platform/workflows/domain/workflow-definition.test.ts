import { describe, expect, it } from "vitest";
import { WorkflowDefinition } from "./workflow-definition";
import { createWorkflowDefinitionId } from "./workflow-definition-id";
import { createWorkflowStepId } from "./workflow-step-id";

describe("WorkflowDefinition", () => {
  it("normalizes immutable definitions and orders steps", () => {
    const value = WorkflowDefinition.create({
      id: createWorkflowDefinitionId("definition"), title: " Process ", description: " Repeatable work ",
      steps: [
        { id: createWorkflowStepId("second"), title: "Second", description: "Second step", order: 2, requiredActionTypes: [] },
        { id: createWorkflowStepId("first"), title: "First", description: "First step", order: 1, requiredActionTypes: [] },
      ],
    });
    expect(value.title).toBe("Process");
    expect(value.steps.map((step) => step.id.value)).toEqual(["first", "second"]);
    expect(Object.isFrozen(value.steps)).toBe(true);
  });

  it("rejects duplicate ordering and missing dependencies", () => {
    expect(() => WorkflowDefinition.create({
      id: createWorkflowDefinitionId("duplicate"), title: "Duplicate", description: "Invalid definition", steps: [
        { id: createWorkflowStepId("one"), title: "One", description: "One", order: 1, requiredActionTypes: [] },
        { id: createWorkflowStepId("two"), title: "Two", description: "Two", order: 1, requiredActionTypes: [] },
      ],
    })).toThrow("Workflow definition step orders must be unique.");
    expect(() => WorkflowDefinition.create({
      id: createWorkflowDefinitionId("missing"), title: "Missing", description: "Invalid definition", steps: [
        { id: createWorkflowStepId("one"), title: "One", description: "One", order: 1, requiredActionTypes: [], dependencyIds: [createWorkflowStepId("unknown")] },
      ],
    })).toThrow("Workflow step dependency not found: unknown.");
  });

  it("rejects cyclic dependencies", () => {
    const one = createWorkflowStepId("one"), two = createWorkflowStepId("two");
    expect(() => WorkflowDefinition.create({
      id: createWorkflowDefinitionId("cycle"), title: "Cycle", description: "Invalid definition", steps: [
        { id: one, title: "One", description: "One", order: 1, requiredActionTypes: [], dependencyIds: [two] },
        { id: two, title: "Two", description: "Two", order: 2, requiredActionTypes: [], dependencyIds: [one] },
      ],
    })).toThrow("Workflow step dependencies cannot contain a cycle.");
  });
});
