import { describe, expect, it } from "vitest";
import { ExecutionStatus } from "../../execution";
import { WorkflowCollection } from "../domain";
import { WorkflowSession } from "./workflow-session";

describe("WorkflowSession", () => {
  it("creates immutable empty sessions with consistent statistics", () => {
    const session = WorkflowSession.create({
      workflows: WorkflowCollection.empty(), status: ExecutionStatus.COMPLETED,
      statistics: { startedAt: new Date(), completedAt: new Date(), processed: 0, succeeded: 0, skipped: 0, failed: 0 },
      diagnostics: { warnings: [], errors: [], skippedItems: [], exceptions: [] },
    });
    expect(session.workflows.isEmpty).toBe(true);
    expect(Object.isFrozen(session)).toBe(true);
  });

  it("rejects inconsistent execution statistics", () => {
    expect(() => WorkflowSession.create({
      workflows: WorkflowCollection.empty(), status: ExecutionStatus.COMPLETED,
      statistics: { startedAt: new Date(), processed: 1, succeeded: 1, skipped: 0, failed: 0 },
      diagnostics: { warnings: [], errors: [], skippedItems: [], exceptions: [] },
    })).toThrow("Workflow execution outcomes must match definitions processed.");
  });
});
