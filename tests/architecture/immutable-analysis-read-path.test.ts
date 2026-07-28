import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

describe("SA-001C immutable analysis read path", () => {
  it("keeps the canonical projection independent from providers and calculations", () => {
    const projection = source("src/features/investment-opportunity/application/immutable-analysis-projection.ts");
    expect(projection).not.toMatch(/RentCast|Hospitable|Stripe|provider.*request|calculate|recompute/i);
    expect(projection).toContain("investment-analysis-projection.v1");
    expect(projection).toContain("structuredClone");
    expect(projection).toContain("deepFreeze");
  });

  it("routes historical rendering, reanalysis, and reporting through the immutable boundary", () => {
    expect(source("src/features/investment-opportunity/application/analysis-detail.ts")).toContain("readImmutableAnalysis");
    expect(source("src/features/investment-opportunity/application/save-workflow.ts")).toContain("readImmutableAnalysis");
    const reporting = source("src/app/actions/reporting.ts");
    const projectionBody = reporting.slice(reporting.indexOf("async function investmentProjection"), reporting.indexOf("async function financialProjection"));
    expect(projectionBody).toContain("readImmutableAnalysis");
    expect(projectionBody).not.toContain('from("investment_opportunity_analyses")');
  });

  it("resolves the latest version by canonical sequence rather than timestamps", () => {
    const projection = source("src/features/investment-opportunity/application/immutable-analysis-projection.ts");
    expect(projection).toContain("right.sequence - left.sequence");
    expect(projection).not.toContain("getTime()");
  });
});
