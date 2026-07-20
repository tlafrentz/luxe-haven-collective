import { describe, expect, it } from "vitest";
import { ExecutionStatus } from "../../execution";
import { IntelligenceCollection } from "../domain";
import { IntelligenceSession } from "./intelligence-session";

describe("IntelligenceSession", () => {
  it("creates immutable empty sessions", () => {
    const session = IntelligenceSession.create({ intelligence: IntelligenceCollection.empty(), status: ExecutionStatus.COMPLETED,
      statistics: { startedAt: new Date(), completedAt: new Date(), processed: 0, succeeded: 0, skipped: 0, failed: 0 }, diagnostics: { warnings: [], errors: [], skippedItems: [], exceptions: [] },
    });
    expect(session.intelligence.isEmpty).toBe(true); expect(Object.isFrozen(session)).toBe(true);
  });
  it("rejects inconsistent statistics", () => {
    expect(() => IntelligenceSession.create({ intelligence: IntelligenceCollection.empty(), status: ExecutionStatus.COMPLETED,
      statistics: { startedAt: new Date(), processed: 1, succeeded: 1, skipped: 0, failed: 0 }, diagnostics: { warnings: [], errors: [], skippedItems: [], exceptions: [] },
    })).toThrow("Intelligence execution statistics must match policies processed.");
  });
});
