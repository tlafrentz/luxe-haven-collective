import { describe, expect, it } from "vitest";
import { createWorkflowDefinitionId } from "../domain";
import { definition } from "../workflow-fixtures.test-support";
import { WorkflowRegistry } from "./workflow-registry";

describe("WorkflowRegistry", () => {
  it("registers, resolves, and enumerates definitions immutably", () => {
    const empty = WorkflowRegistry.empty();
    const registry = empty.register(definition());
    expect(empty.size).toBe(0);
    expect(registry.require(createWorkflowDefinitionId("review-and-publish")).title).toBe("Review and Publish");
    expect([...registry]).toHaveLength(1);
  });

  it("rejects duplicate definitions and missing lookups", () => {
    expect(() => WorkflowRegistry.create([definition(), definition()])).toThrow("Workflow definition IDs must be unique.");
    expect(() => WorkflowRegistry.empty().require(createWorkflowDefinitionId("missing"))).toThrow("Workflow definition not found: missing.");
  });
});
