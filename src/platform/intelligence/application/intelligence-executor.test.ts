import { describe, expect, it } from "vitest";
import { ExecutionStatus } from "../../execution";
import { createIntelligenceReportId } from "../domain";
import { outcomes, policy } from "../intelligence-fixtures.test-support";
import { IntelligenceExecutor } from "./intelligence-executor";
import type { IntelligencePolicy } from "./intelligence-policy";
import { IntelligencePolicyRegistry } from "./intelligence-policy-registry";

describe("IntelligenceExecutor", () => {
  it("coordinates reproducible policy analysis and report construction", async () => {
    const session = await new IntelligenceExecutor(IntelligencePolicyRegistry.create([policy])).execute({
      records: { outcomes: outcomes(), historical: { revenue: [1000, 1200] } }, createReportId: () => createIntelligenceReportId("report-1"), metadata: { cadence: "monthly" },
    });
    expect(session.status).toBe(ExecutionStatus.COMPLETED); expect(session.intelligence.size).toBe(1);
    expect(session.intelligence.toArray()[0].id.value).toBe("report-1");
    expect(session.statistics).toMatchObject({ processed: 1, succeeded: 1, skipped: 0, failed: 0 });
    expect(session.metadata).toEqual({ cadence: "monthly" });
  });
  it("skips unsupported policies and diagnoses empty analytical results", async () => {
    const unsupported: IntelligencePolicy = { name: "unsupported", supports: () => false, analyze: () => { throw new Error("should not run"); } };
    const empty: IntelligencePolicy = { name: "empty", supports: () => true, analyze: () => undefined };
    const session = await new IntelligenceExecutor(IntelligencePolicyRegistry.create([unsupported, empty])).execute({ records: { outcomes: outcomes() } });
    expect(session.status).toBe(ExecutionStatus.COMPLETED_WITH_WARNINGS); expect(session.statistics.skipped).toBe(2);
    expect(session.diagnostics.warnings).toEqual(['Intelligence policy "empty" produced no report.']);
  });
  it("isolates analytical engine failures", async () => {
    const failed: IntelligencePolicy = { name: "failed", supports: () => true, analyze: () => { throw new Error("Analytical engine unavailable"); } };
    const session = await new IntelligenceExecutor(IntelligencePolicyRegistry.create([failed])).execute({ records: { outcomes: outcomes() } });
    expect(session.status).toBe(ExecutionStatus.FAILED); expect(session.statistics.failed).toBe(1);
    expect(session.diagnostics.errors[0]).toContain("Analytical engine unavailable");
  });
});
