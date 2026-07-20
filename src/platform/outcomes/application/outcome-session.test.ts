import { describe, expect, it } from "vitest";
import { ExecutionStatus } from "../../execution";
import { OutcomeCollection } from "../domain";
import { OutcomeSession } from "./outcome-session";

describe("OutcomeSession", () => {
  it("creates immutable empty sessions", () => {
    const session = OutcomeSession.create({ outcomes: OutcomeCollection.empty(), status: ExecutionStatus.COMPLETED,
      statistics: { startedAt: new Date(), completedAt: new Date(), processed: 0, succeeded: 0, skipped: 0, failed: 0 },
      diagnostics: { warnings: [], errors: [], skippedItems: [], exceptions: [] },
    });
    expect(session.outcomes.isEmpty).toBe(true); expect(Object.isFrozen(session)).toBe(true);
  });
  it("rejects inconsistent statistics", () => {
    expect(() => OutcomeSession.create({ outcomes: OutcomeCollection.empty(), status: ExecutionStatus.COMPLETED,
      statistics: { startedAt: new Date(), processed: 1, succeeded: 1, skipped: 0, failed: 0 }, diagnostics: { warnings: [], errors: [], skippedItems: [], exceptions: [] },
    })).toThrow("Outcome execution statistics must match sources processed.");
  });
});
