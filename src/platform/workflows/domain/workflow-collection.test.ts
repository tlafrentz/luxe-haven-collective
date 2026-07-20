import { describe, expect, it } from "vitest";
import { WorkflowBuilder } from "../application";
import { actions, definition } from "../workflow-fixtures.test-support";
import { WorkflowCollection } from "./workflow-collection";

describe("WorkflowCollection", () => {
  it("supports lookup, filtering, grouping, and aggregation", () => {
    const workflow = new WorkflowBuilder().build({ definition: definition(), actions: actions(), createdAt: new Date() });
    const collection = WorkflowCollection.create([workflow]);
    expect(collection.require(workflow.id)).toBe(workflow);
    expect(collection.ofStatus("ready").size).toBe(1);
    expect(collection.ofDefinition(workflow.definitionId).size).toBe(1);
    expect(collection.groupByStatus().get("ready")?.size).toBe(1);
    expect(collection.countByStatus().get("ready")).toBe(1);
  });

  it("rejects duplicate workflow identities", () => {
    const workflow = new WorkflowBuilder().build({ definition: definition(), actions: actions(), createdAt: new Date() });
    expect(() => WorkflowCollection.create([workflow, workflow])).toThrow("Workflow IDs must be unique.");
  });
});
