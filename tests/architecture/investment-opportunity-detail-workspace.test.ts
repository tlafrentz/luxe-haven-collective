import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
describe("Investment Opportunity detail workspace architecture", () => {
  it("keeps the canonical page a thin workspace-query composition layer", () => {
    const page = read("src/app/(dashboard)/dashboard/investments/opportunities/[id]/page.tsx");
    expect(page).toContain("getAcquisitionWorkspaceRequestContext");
    expect(page).toContain("context.handler.execute");
    expect(page).toContain("AcquisitionOpportunityWorkspace");
    expect(page).not.toMatch(/Repository|Supabase|findById|listAnalyses|hydrate|buildAcquisitionWorkspace/);
  });

  it("keeps repository composition in a server-only runtime", () => {
    const runtime = read("src/app/actions/acquisition-workspace-query-runtime.ts");
    expect(runtime).toContain('import "server-only"');
    expect(runtime).toContain("composeAcquisitionWorkspaceProduction");
    expect(runtime).toContain("SupabaseAcquisitionPipelineRepository");
  });

  it("keeps presentation components data-only", () => {
    const component = read("src/features/investment-opportunity/components/acquisition-opportunity-workspace.tsx");
    expect(component).not.toMatch(/Repository|Supabase|findById|handler\\.execute|createClient|requireUser|requireRole/);
    expect(component).toContain("aria-current");
    expect(component).toContain("aria-labelledby");
  });

  it("provides progressive loading and a safe route error boundary", () => {
    const loading = read("src/app/(dashboard)/dashboard/investments/opportunities/[id]/loading.tsx");
    const error = read("src/app/(dashboard)/dashboard/investments/opportunities/[id]/error.tsx");
    expect(loading).toContain('aria-busy="true"');
    expect(loading).toContain("motion-reduce:animate-none");
    expect(error).toContain('"use client"');
    expect(error).not.toContain("error.message");
  });
});
