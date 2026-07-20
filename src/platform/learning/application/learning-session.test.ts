import { describe, expect, it } from "vitest";
import { ExecutionStatus } from "../../execution";
import { LearningCollection } from "../domain";
import { LearningSession } from "./learning-session";

describe("LearningSession", () => {
  it("creates immutable empty sessions", () => { const session = LearningSession.create({ learning: LearningCollection.empty(), status: ExecutionStatus.COMPLETED, statistics: { startedAt: new Date(), completedAt: new Date(), processed: 0, succeeded: 0, skipped: 0, failed: 0 }, diagnostics: { warnings: [], errors: [], skippedItems: [], exceptions: [] } }); expect(session.learning.isEmpty).toBe(true); expect(Object.isFrozen(session)).toBe(true); });
  it("rejects inconsistent statistics", () => { expect(() => LearningSession.create({ learning: LearningCollection.empty(), status: ExecutionStatus.COMPLETED, statistics: { startedAt: new Date(), processed: 1, succeeded: 1, skipped: 0, failed: 0 }, diagnostics: { warnings: [], errors: [], skippedItems: [], exceptions: [] } })).toThrow("Learning execution statistics must match policies processed."); });
});
