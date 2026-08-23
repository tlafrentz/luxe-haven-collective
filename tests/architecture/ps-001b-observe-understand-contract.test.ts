import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getIntelligenceReportRequestHref, intelligenceActionContracts, understandRoutes } from "../../src/platform/experience";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("PS-001B Observe and Understand stabilization contract", () => {
  it("registers every shared intelligence action as an observable outcome", () => {
    const required = [
      "revenue-refresh", "revenue-sources", "revenue-manage-data", "revenue-export", "revenue-export-options",
      "financial-refresh", "financial-sources", "financial-manage-data", "financial-export", "financial-export-options",
      "executive-refresh", "executive-sources", "executive-attention", "executive-export",
      "portfolio-refresh", "portfolio-sources", "portfolio-signals", "portfolio-data-quality", "portfolio-property", "portfolio-export",
    ];
    expect(new Set(intelligenceActionContracts.map(({ id }) => id)).size).toBe(intelligenceActionContracts.length);
    expect(intelligenceActionContracts.map(({ id }) => id)).toEqual(expect.arrayContaining(required));
    expect(intelligenceActionContracts.every(({ outcome }) => outcome.trim().length > 0)).toBe(true);
  });

  it("uses one context-preserving Reports boundary for current and full exports", () => {
    expect(getIntelligenceReportRequestHref("financial", "cash-flow", "current-view")).toBe("/dashboard/reports/new?sourceCapability=financial&sourceView=cash-flow&reportScope=current-view");
    expect(getIntelligenceReportRequestHref("portfolio", "overview", "full-capability")).toContain("reportScope=full-capability");
    const actions = read("src/features/financial-intelligence/presentation/financial-shell-actions.tsx");
    expect(actions).toContain("<ContextLink href={href}");
    expect(actions).not.toContain("window.print");
    expect(actions).not.toMatch(/reports\/definitions\//);
  });

  it("does not manufacture provider connection state in intelligence presentation", () => {
    const actions = read("src/features/financial-intelligence/presentation/financial-shell-actions.tsx");
    expect(actions).toContain("does not infer provider state");
    expect(actions).not.toContain('["Hospitable","Connected"');
    expect(actions).not.toContain('["Bank Accounts","Not connected"');
  });

  it("keeps diagnostics canonical, contextual, and free of primary Portfolio tabs", () => {
    expect(understandRoutes.attention).toBe("/dashboard/understand/executive/attention");
    expect(understandRoutes.portfolioDataQuality).toBe("/dashboard/understand/portfolio/data-quality");
    const navigation = read("src/components/intelligence-workspace-navigation.tsx");
    expect(navigation).toContain('pathname.endsWith("/data-quality")');
    expect(navigation).toContain('searchParams?.has("property")');
    expect(read("src/app/(dashboard)/dashboard/understand/portfolio/data-quality/page.tsx")).toContain("Return to Portfolio Intelligence");
  });

  it("keeps every controlled journey destination loadable", () => {
    const paths = [
      "src/app/(dashboard)/dashboard/observe/revenue/page.tsx",
      "src/app/(dashboard)/dashboard/observe/financial/page.tsx",
      "src/app/(dashboard)/dashboard/observe/financial/expenses/page.tsx",
      "src/app/(dashboard)/dashboard/observe/financial/cash-flow/page.tsx",
      "src/app/(dashboard)/dashboard/observe/financial/forecast/page.tsx",
      "src/app/(dashboard)/dashboard/understand/executive/page.tsx",
      "src/app/(dashboard)/dashboard/understand/executive/attention/page.tsx",
      "src/app/(dashboard)/dashboard/understand/portfolio/page.tsx",
      "src/app/(dashboard)/dashboard/understand/portfolio/properties/page.tsx",
      "src/app/(dashboard)/dashboard/understand/portfolio/concentration/page.tsx",
      "src/app/(dashboard)/dashboard/understand/portfolio/data-quality/page.tsx",
    ];
    for (const path of paths) expect(existsSync(resolve(path)), path).toBe(true);
  });
});
