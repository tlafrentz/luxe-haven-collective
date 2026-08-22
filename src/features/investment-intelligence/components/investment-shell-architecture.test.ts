import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { intelligenceActionContracts } from "@/platform/experience/routing/intelligence-action-contracts";
import { getIntelligenceReportRequestHref } from "@/platform/experience/routing/intelligence-report-routes";

const root = process.cwd();
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("DI-002 Investment Intelligence shell contract", () => {
  it("owns exactly the four canonical local destinations and no shell command", () => {
    const shell = source("src/features/investment-intelligence/components/investment-workspace-shell-navigation.tsx");
    for (const label of ["Overview", "Analyze", "Scenarios", "Opportunities"]) {
      expect(shell).toContain(`label: "${label}"`);
    }
    expect(shell).not.toContain('label: "Reports"');
    expect(shell).not.toContain('label: "Settings"');
    expect(shell).not.toContain("New Analysis");
    expect(shell).not.toContain("action=");
  });

  it("keeps the sole New Analysis command in the semantic page header", () => {
    const overview = source("src/features/investment-intelligence/components/investment-intelligence-overview.tsx");
    expect(overview.match(/<NewAnalysisDialog/g)).toHaveLength(1);
  });

  it("routes compatibility destinations and reporting through platform homes", () => {
    expect(source("src/app/(dashboard)/dashboard/investments/reports/page.tsx")).toContain('redirect("/dashboard/reports")');
    expect(source("src/app/(dashboard)/dashboard/investments/settings/page.tsx")).toContain('redirect("/dashboard/workspace/connected-systems")');
    expect(getIntelligenceReportRequestHref("investment", "overview")).toBe(
      "/dashboard/reports/new?sourceCapability=investment&sourceView=overview",
    );
  });

  it("registers every visible Decide action in the platform action audit", () => {
    const contracts = intelligenceActionContracts.filter((item) => item.source === "decide-investment");
    expect(contracts.map((item) => item.label)).toEqual([
      "Overview",
      "Analyze",
      "Scenarios",
      "Opportunities",
      "New Analysis",
      "Generate Report",
    ]);
    expect(contracts.every((item) => item.outcome.length > 0)).toBe(true);
  });
});
