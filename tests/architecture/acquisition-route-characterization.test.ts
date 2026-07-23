import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { platformRouteDefinitions, resolveWorkspaceForPath } from "../../src/platform/experience";

const root = process.cwd();
const route = (path: string) => readFileSync(join(root, path), "utf8");
const canonical = [
  ["/dashboard/investments", "src/app/(dashboard)/dashboard/investments/page.tsx"],
  ["/dashboard/investments/new", "src/app/(dashboard)/dashboard/investments/new/page.tsx"],
  ["/dashboard/investments/opportunities", "src/app/(dashboard)/dashboard/investments/opportunities/page.tsx"],
  ["/dashboard/investments/opportunities/[id]", "src/app/(dashboard)/dashboard/investments/opportunities/[id]/page.tsx"],
  ["/dashboard/investments/opportunities/[id]/analyses/[analysisId]", "src/app/(dashboard)/dashboard/investments/opportunities/[id]/analyses/[analysisId]/page.tsx"],
] as const;

describe("IA-002B.2.1 current acquisition route characterization", () => {
  it("keeps the canonical route inventory complete and uniquely owned", () => {
    for (const [path, filesystem] of canonical) {
      expect(route(filesystem).length, `${filesystem} should exist`).toBeGreaterThan(0);
      expect(platformRouteDefinitions.filter(item => item.pathPattern === path)).toHaveLength(1);
    }
  });

  it.each([
    "/dashboard/investments/opportunities/one",
    "/dashboard/investments/opportunities/one/analyses/two",
    "/dashboard/investments/portfolio/one",
    "/dashboard/investments/portfolio/one/analyses/two",
  ])("%s remains owned by Decide", path => expect(resolveWorkspaceForPath(path)).toBe("decide"));

  it("freezes compatibility aliases as route-module aliases, not redirects", () => {
    expect(route("src/app/(dashboard)/dashboard/investments/opportunities/page.tsx")).toContain('export { default } from "../portfolio/page"');
    expect(route("src/app/(dashboard)/dashboard/investments/opportunities/[id]/page.tsx")).toContain('export { default } from "../../portfolio/[id]/page"');
    expect(route("src/app/(dashboard)/dashboard/investments/opportunities/[id]/analyses/[analysisId]/page.tsx")).toContain('export { default } from "../../../../portfolio/[id]/analyses/[analysisId]/page"');
  });

  it("preserves legacy analysis query parameters through the overview redirect", () => {
    const source = route("src/app/(dashboard)/dashboard/investments/page.tsx");
    expect(source).toContain("params.strategy || params.opportunity || params.mode");
    expect(source).toContain('redirect(`/dashboard/investments/new?${query}`)');
    expect(source).toContain("query.append(key, item)");
  });

  it("does not let child routes fall through to the overview implementation", () => {
    const overview = route("src/app/(dashboard)/dashboard/investments/page.tsx");
    expect(overview).not.toContain("InvestmentOpportunityDetailPage");
    expect(overview).not.toContain("HistoricalOpportunityAnalysisPage");
  });

  it("keeps route pages free of direct Supabase and persistence-row imports", () => {
    const pages = canonical.map(([, filesystem]) => route(filesystem)).join("\n");
    expect(pages).not.toMatch(/@\/lib\/supabase|supabase-js|PersistenceRow|infrastructure\/persistence/);
  });

  it("keeps acquisition domain and opportunity presentation boundaries one-way", () => {
    const pipelineDomain = route("src/features/investment-opportunity/acquisition-pipeline/domain/acquisition-pipeline.ts");
    const opportunityDomain = route("src/features/investment-opportunity/domain/investment-opportunity.ts");
    expect(pipelineDomain).not.toMatch(/components|presentation|app\/|supabase/);
    expect(opportunityDomain).not.toMatch(/acquisition-pipeline\/infrastructure|components|presentation/);
  });

  it("records the current browser boundary as opportunity-only", () => {
    const detailPage = route("src/app/(dashboard)/dashboard/investments/portfolio/[id]/page.tsx");
    expect(detailPage).toContain("loadOpportunityDetail");
    expect(detailPage).not.toMatch(/AcquisitionPipeline|findByOpportunity|getAcquisitionClosingReadiness/);
  });
});
