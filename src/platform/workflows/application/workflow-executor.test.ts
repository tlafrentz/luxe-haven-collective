import { describe, expect, it } from "vitest";
import { ActionCollection } from "../../actions";
import { ExecutionStatus } from "../../execution";
import { createWorkflowDefinitionId, createWorkflowId, WorkflowDefinition } from "../domain";
import { actions, definition } from "../workflow-fixtures.test-support";
import { WorkflowExecutor } from "./workflow-executor";
import { WorkflowRegistry } from "./workflow-registry";

describe("WorkflowExecutor", () => {
  it("resolves definitions and orchestrates deterministic workflow construction", async () => {
    const times = [new Date("2026-07-19T12:00:00Z"), new Date("2026-07-19T12:00:01Z"), new Date("2026-07-19T12:00:02Z")];
    const session = await new WorkflowExecutor(WorkflowRegistry.create([definition()])).execute({
      actions: actions(), now: () => times.shift()!, createWorkflowId: () => createWorkflowId("workflow-1"), metadata: { batch: "daily" },
    });
    expect(session.status).toBe(ExecutionStatus.COMPLETED);
    expect(session.workflows.size).toBe(1);
    expect(session.workflows.toArray()[0].id.value).toBe("workflow-1");
    expect(session.statistics).toMatchObject({ processed: 1, succeeded: 1, skipped: 0, failed: 0, durationMs: 2000 });
    expect(session.metadata).toEqual({ batch: "daily" });
  });

  it("diagnoses definitions whose required Actions are unavailable", async () => {
    const session = await new WorkflowExecutor().execute({ actions: ActionCollection.empty(), registry: WorkflowRegistry.create([definition()]) });
    expect(session.status).toBe(ExecutionStatus.COMPLETED_WITH_WARNINGS);
    expect(session.workflows.isEmpty).toBe(true);
    expect(session.statistics.skipped).toBe(1);
    expect(session.diagnostics.warnings[0]).toContain("Missing Action types: review");
  });

  it("reports requested definitions that are not registered", async () => {
    const missing = createWorkflowDefinitionId("missing");
    const session = await new WorkflowExecutor(WorkflowRegistry.empty()).execute({ actions: actions(), options: { definitionIds: [missing] } });
    expect(session.status).toBe(ExecutionStatus.FAILED);
    expect(session.statistics.failed).toBe(1);
    expect(session.diagnostics.errors).toEqual(["Workflow definition not found: missing."]);
  });

  it("constructs workflows from empty definitions", async () => {
    const empty = WorkflowDefinition.create({ id: createWorkflowDefinitionId("empty"), title: "Empty", description: "No work", steps: [] });
    const session = await new WorkflowExecutor(WorkflowRegistry.create([empty])).execute({ actions: ActionCollection.empty() });
    expect(session.status).toBe(ExecutionStatus.COMPLETED);
    expect(session.workflows.toArray()[0].status).toBe("completed");
  });
});
