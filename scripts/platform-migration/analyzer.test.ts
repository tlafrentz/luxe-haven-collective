import { describe, expect, it } from "vitest";
import { adoptionReport, analyzeRepository, architectureViolations, dependencyGraph, duplicateImports } from "./analyzer";

const analysis = analyzeRepository();

describe("platform migration analyzer", () => {
  it("builds a cross-package dependency graph", () => {
    const graph = dependencyGraph(analysis);
    expect(graph.some((edge) => edge.from === "feature:action-center" && edge.to === "platform:actions")).toBe(true);
    expect(graph.some((edge) => edge.from === "feature:action-center" && edge.to === "feature:execution-engine")).toBe(false);
    expect(graph.every((edge) => edge.count > 0)).toBe(true);
  });

  it("reports platform adoption for every feature", () => {
    const report = adoptionReport(analysis);
    expect(report.map((value) => value.feature)).toEqual(analysis.features);
    expect(report.find((value) => value.feature === "action-center")?.platformPackages).toContain("actions");
    expect(report.find((value) => value.feature === "action-center")!.effectiveAdoptingFiles).toBeGreaterThanOrEqual(
      report.find((value) => value.feature === "action-center")!.adoptingFiles,
    );
  });

  it("returns deterministic duplicate-import findings", () => {
    const duplicates = duplicateImports(analysis);
    expect(duplicates).toEqual([...duplicates].sort((left, right) => left.file.localeCompare(right.file) || left.symbol.localeCompare(right.symbol)));
  });

  it("passes the frozen Platform v1 dependency rules", () => {
    expect(architectureViolations(analysis)).toEqual([]);
  });
});
