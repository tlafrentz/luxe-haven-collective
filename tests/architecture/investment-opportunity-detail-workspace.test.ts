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
    const lifecycle = read("src/features/investment-opportunity/components/acquisition-lifecycle-experience.tsx");
    expect(component).not.toMatch(/Repository|Supabase|findById|handler\\.execute|createClient|requireUser|requireRole/);
    expect(lifecycle).not.toMatch(/Repository|Supabase|findById|handler\\.execute|createClient|requireUser|requireRole/);
    expect(lifecycle).toContain("aria-current");
    expect(lifecycle).toContain('role="progressbar"');
    expect(component).toContain("aria-labelledby");
  });

  it("keeps lifecycle commands typed and behind the established server boundary", () => {
    const action = read("src/features/investment-opportunity/components/acquisition-primary-action.tsx");
    expect(action).toContain("@/app/actions/acquisition-workspace-commands");
    expect(action).not.toMatch(/Repository|Supabase|createClient|aggregate|ownerId|actorId/);
    expect(action).toContain('result?.status === "conflict"');
    expect(action).toContain('result?.status === "succeeded"');
    expect(action).toContain("router.refresh()");
  });

  it("keeps the negotiation workspace projection-only and route discriminated", () => {
    const commercial = read("src/features/investment-opportunity/components/acquisition-commercial-workspace.tsx");
    expect(commercial).not.toMatch(/Repository|Supabase|createClient|requireUser|requireRole|aggregate/);
    expect(commercial).toContain('terms.route === "purchase"');
    expect(commercial).toContain('current.route === "rental-arbitrage"');
    expect(commercial).toContain("proposedMonthlyRent");
    expect(commercial).toContain("primaryAction");
    expect(commercial).toContain("buildCommercialDeltas");
    expect(commercial).toContain("sourceAnalysis");
    expect(commercial).not.toMatch(/projectedCoC|cashOnCash|netOperatingIncome/);
  });

  it("submits reviewed offers only through the typed command boundary", () => {
    const review = read("src/features/investment-opportunity/components/acquisition-offer-review.tsx");
    expect(review).toContain("submitAcquisitionOfferAction");
    expect(review).toContain("expectedPipelineVersion");
    expect(review).toContain("crypto.randomUUID()");
    expect(review).toContain("router.refresh()");
    expect(review).toContain('result?.status === "conflict"');
    expect(review).toContain('result?.status === "blocked"');
    expect(review).toContain('result?.status === "unavailable"');
    expect(review).not.toMatch(/Repository|Supabase|createClient|aggregate|window\.confirm|confirm\(/);
  });

  it("keeps due diligence presentation on bounded workspace projections", () => {
    const diligence = read("src/features/investment-opportunity/components/acquisition-due-diligence-workspace.tsx");
    const contracts = read("src/features/investment-opportunity/acquisition-workspace/application/contracts.ts");
    expect(diligence).not.toMatch(/Repository|Supabase|createClient|requireUser|aggregate|evidencePayload|documentUrl|mimeType/);
    expect(diligence).toContain("AcquisitionRequirementsWorkspaceSummary");
    expect(diligence).toContain("primaryAction");
    expect(diligence).toContain("<details");
    expect(diligence).toContain("Evidence content, provenance, URLs, and document previews are intentionally excluded");
    expect(contracts).toContain("AcquisitionRequirementEvidenceCounts");
    expect(contracts).toContain("AcquisitionRequirementRiskWorkspaceSummary");
    expect(contracts).toContain("AcquisitionRequirementDependencySummary");
  });

  it("keeps closing presentation projection-only and mutations behind the typed boundary", () => {
    const closing = read("src/features/investment-opportunity/components/acquisition-closing-workspace.tsx");
    expect(closing).toContain("closeAcquisitionAction");
    expect(closing).toContain("expectedPipelineVersion");
    expect(closing).toContain("crypto.randomUUID()");
    expect(closing).toContain('role="dialog"');
    expect(closing).toContain("router.refresh()");
    expect(closing).toContain('result?.status === "conflict"');
    expect(closing).toContain('result?.status === "blocked"');
    expect(closing).toContain('result?.status === "unavailable"');
    expect(closing).not.toMatch(/Repository|Supabase|createClient|requireUser|PersistenceRow|documentUrl|mimeType|evidenceContent|window\.confirm/);
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
