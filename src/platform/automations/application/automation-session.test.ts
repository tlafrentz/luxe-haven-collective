import { describe, expect, it } from "vitest";
import { ExecutionStatus } from "../../execution";
import { AutomationHistory } from "../domain";
import { AutomationSession } from "./automation-session";

describe("AutomationSession", () => {
  it("creates immutable empty-cycle sessions", () => {
    const history = AutomationHistory.empty();
    const session = AutomationSession.create({ executions: history, history, status: ExecutionStatus.COMPLETED,
      statistics: { startedAt: new Date(), completedAt: new Date(), processed: 0, succeeded: 0, skipped: 0, failed: 0 },
      diagnostics: { warnings: [], errors: [], skippedItems: [], exceptions: [] }, metadata: { cycle: "manual" },
    });
    expect(session.executions.size).toBe(0); expect(session.metadata).toEqual({ cycle: "manual" }); expect(Object.isFrozen(session)).toBe(true);
  });
  it("rejects statistics inconsistent with cycle executions", () => {
    const history = AutomationHistory.empty();
    expect(() => AutomationSession.create({ executions: history, history, status: ExecutionStatus.COMPLETED,
      statistics: { startedAt: new Date(), processed: 1, succeeded: 1, skipped: 0, failed: 0 },
      diagnostics: { warnings: [], errors: [], skippedItems: [], exceptions: [] },
    })).toThrow("Automation execution statistics must match cycle executions.");
  });
});
