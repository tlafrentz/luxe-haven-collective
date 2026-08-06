import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = (path: string) => readFileSync(new URL(`../../src/app/(dashboard)/dashboard/${path}/page.tsx`, import.meta.url), "utf8");
const home = () => readFileSync(new URL("../../src/app/(dashboard)/dashboard/page.tsx", import.meta.url), "utf8");

describe("production dashboard boundaries", () => {
  it("routes intelligence landings through canonical production views", () => {
    expect(route("observe/revenue")).toContain("insights/page");
    expect(route("observe/financial")).toContain("financial/page");
    expect(route("understand/executive")).toContain("ExecutivePageView");
    expect(route("understand/portfolio")).toContain("portfolio/page");
    expect(route("investments")).toContain("InvestmentIntelligenceOverview");
    expect(route("learning")).toContain("health/page");
  });

  it("loads operational, action, and reporting records from production readers", () => {
    expect(home()).toContain("getOperationalSurfaceProjection");
    expect(home()).toContain("const projection = filterOperationalProjection");
    expect(route("actions")).toContain("ProviderActionCenterReader");
    expect(route("reports")).toContain("getExecutiveReportWorkspace");
  });

  it("does not render the removed fixture dashboard", () => {
    expect(home()).not.toContain("HpmDashboard");
    for (const path of ["observe/revenue", "observe/financial", "understand/executive", "understand/portfolio", "investments", "actions", "learning", "reports"]) {
      expect(route(path)).not.toContain("HpmDashboard");
    }
  });
});
