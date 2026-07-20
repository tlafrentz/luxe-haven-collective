import { describe, expect, it } from "vitest";
import { ExecutionStatus } from "../../execution";
import { createLearningReportId } from "../domain";
import { policy, records } from "../learning-fixtures.test-support";
import { LearningExecutor } from "./learning-executor";
import type { LearningPolicy } from "./learning-policy";
import { LearningPolicyRegistry } from "./learning-policy-registry";

describe("LearningExecutor", () => {
  it("coordinates reproducible proposal generation without changing source records", async () => {
    const source = records(), outcomeBefore = source.outcomes.toArray()[0], intelligenceBefore = source.intelligence.toArray()[0];
    const session = await new LearningExecutor(LearningPolicyRegistry.create([policy])).execute({ records: source, createReportId: () => createLearningReportId("learning-1"), metadata: { cadence: "quarterly" } });
    expect(session.status).toBe(ExecutionStatus.COMPLETED); expect(session.learning.toArray()[0].id.value).toBe("learning-1");
    expect(session.statistics).toMatchObject({ processed: 1, succeeded: 1, skipped: 0, failed: 0 }); expect(session.metadata).toEqual({ cadence: "quarterly" });
    expect(source.outcomes.toArray()[0]).toBe(outcomeBefore); expect(source.intelligence.toArray()[0]).toBe(intelligenceBefore);
  });
  it("skips unsupported and empty policies with diagnostics", async () => {
    const unsupported: LearningPolicy = { name: "unsupported", supports: () => false, learn: () => { throw new Error("not called"); } };
    const empty: LearningPolicy = { name: "empty", supports: () => true, learn: () => undefined };
    const session = await new LearningExecutor(LearningPolicyRegistry.create([unsupported, empty])).execute({ records: records() });
    expect(session.status).toBe(ExecutionStatus.COMPLETED_WITH_WARNINGS); expect(session.statistics.skipped).toBe(2); expect(session.diagnostics.warnings).toEqual(['Learning policy "empty" produced no report.']);
  });
  it("isolates learning strategy failures", async () => {
    const failed: LearningPolicy = { name: "failed", supports: () => true, learn: () => { throw new Error("Learning strategy unavailable"); } };
    const session = await new LearningExecutor(LearningPolicyRegistry.create([failed])).execute({ records: records() });
    expect(session.status).toBe(ExecutionStatus.FAILED); expect(session.statistics.failed).toBe(1); expect(session.diagnostics.errors[0]).toContain("Learning strategy unavailable");
  });
});
