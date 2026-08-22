import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("UI-003B Understand Intelligence stabilization", () => {
  it("owns exactly one functional action implementation in the shared intelligence header", () => {
    const header = read("src/components/intelligence-workspace-navigation.tsx");
    const actions = read("src/features/financial-intelligence/presentation/financial-shell-actions.tsx");
    expect(header).toContain("understandCapability");
    expect(header).toContain("<IntelligencePageActions");
    expect(actions).toContain("Review attention");
    expect(actions).toContain("Review data quality");
    expect(actions).toContain("getIntelligenceReportRequestHref");
  });

  it("uses accessible light surfaces for Properties and Concentration", () => {
    const properties = read("src/features/portfolio-intelligence/presentation/portfolio-property-comparison.tsx");
    const concentration = read("src/features/portfolio-intelligence/presentation/portfolio-composition.tsx");
    expect(properties).not.toContain('bg-[#101416]');
    expect(concentration).not.toContain('bg-[#101416]');
    expect(properties).toContain("border-stone-200 bg-white");
    expect(concentration).toContain("border-stone-200 bg-white");
  });

  it("centralizes intelligence and canonical property destinations without guessed property routes", () => {
    const routes = read("src/platform/experience/routing/property-routes.ts");
    const overview = read("src/features/portfolio-intelligence/application/overview/build-portfolio-overview.ts");
    const dashboard = read("src/features/portfolio-intelligence/application/dashboard/build-portfolio-intelligence-dashboard.ts");
    const comparison = read("src/features/portfolio-intelligence/presentation/portfolio-property-comparison.tsx");
    expect(routes).toContain("getPropertyIntelligenceHref");
    expect(routes).toContain("getCanonicalPropertyHref");
    expect(overview).not.toMatch(/`\/properties\//);
    expect(dashboard).not.toMatch(/`\/properties\//);
    expect(comparison).toContain("getCanonicalPropertyHref");
  });
});
