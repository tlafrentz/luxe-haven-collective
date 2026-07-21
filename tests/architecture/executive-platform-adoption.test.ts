import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(path) && !path.endsWith(".test.ts") ? [path] : [];
  });
}

function content(directory: string): string {
  return sourceFiles(directory).map((path) => readFileSync(path, "utf8")).join("\n");
}

describe("Executive Platform adoption boundaries", () => {
  it("keeps removed migration contracts out of Executive production code", () => {
    const executive = content(join(process.cwd(), "src/features/executive-intelligence"));
    const removed = ["ExecutiveIntelligence" + "Report", "Executive" + "Priority", "HpmPerformance" + "Report",
      "mapExecutiveView" + "ToLegacyReport", "ACTION_CENTER_" + "RECORDS", "features/execution-" + "engine"];
    for (const value of removed) expect(executive).not.toContain(value);
  });

  it("keeps Platform independent of product features", () => {
    const platform = content(join(process.cwd(), "src/platform"));
    for (const feature of ["executive-intelligence", "revenue-intelligence", "market-intelligence", "investment-intelligence"]) {
      expect(platform).not.toContain(`features/${feature}`);
    }
  });

  it("keeps Execution Engine and Action Center independent of Executive contracts", () => {
    const execution = content(join(process.cwd(), "src/features/execution-engine"));
    const actionCenter = content(join(process.cwd(), "src/features/action-center"));
    expect(execution).not.toContain("features/executive-" + "intelligence");
    expect(actionCenter).not.toContain("features/executive-" + "intelligence");
    expect(actionCenter).not.toContain("features/execution-" + "engine");
  });
});
