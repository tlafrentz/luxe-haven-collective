import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("FI-002F Observe action completion", () => {
  it("routes every intelligence export request through the Reports workspace boundary", () => {
    const routes = read("src/platform/experience/routing/intelligence-report-routes.ts");
    const actions = read("src/features/financial-intelligence/presentation/financial-shell-actions.tsx");
    const legacy = read("src/features/financial-intelligence/presentation/financial-export-menu.tsx");
    expect(routes).toContain("/dashboard/reports/new?");
    expect(routes).not.toContain("definitionId");
    expect(actions).toContain("getIntelligenceReportRequestHref");
    expect(legacy).toContain("getIntelligenceReportRequestHref");
    expect(actions).not.toMatch(/\/dashboard\/reports\/new\/[`${]/);
  });

  it("makes missing forecast requirements actionable and hides unsupported budget revision commands", () => {
    const planning = read("src/features/financial-intelligence/presentation/financial-planning.tsx");
    expect(planning).toContain("readinessHref(key)");
    expect(planning).toContain("/dashboard/observe/financial/expenses");
    expect(planning).toContain("/dashboard/observe/financial/cash-flow");
    expect(planning).not.toContain(">Create budget revision<");
    expect(planning).not.toContain("<button className=\"mt-3 min-h-10 w-full text-sm font-semibold underline\"");
  });
});
