import{readFileSync}from"node:fs";
import{describe,expect,it}from"vitest";
const source=(path:string)=>readFileSync(path,"utf8");
describe("SA-001F application and RLS alignment",()=>{
  it("uses one application policy before protected persistence and projections",()=>{
    const runtime=source("src/app/actions/investment-opportunity-runtime.ts");
    expect(runtime).toContain("requireInvestmentAuthorization");
    expect(runtime).toContain("authorizeOpportunity");
    expect(source("src/app/(dashboard)/dashboard/investments/portfolio/[id]/analyses/[analysisId]/page.tsx")).toContain('authorizeOpportunity(id,"analysis.read",analysisId)');
    const reanalysis=source("src/app/(dashboard)/dashboard/investments/new/page.tsx");
    expect(reanalysis.indexOf("authorizeOpportunity")).toBeLessThan(reanalysis.indexOf("readImmutableAnalysis(context.repository"));
  });
  it("mirrors role, property, and descendant inheritance in RLS",()=>{
    const sql=source("supabase/migrations/20260727020000_saved_analysis_canonical_recovery.sql");
    expect(sql).toContain("public.active_workspace_role(p_workspace_id) in ('owner','administrator')");
    expect(sql).toContain("public.active_workspace_role(p_workspace_id) in ('operator','contributor')");
    expect(sql).toContain("public.can_access_workspace_property(p_property_id)");
    expect(sql).toContain('create policy "Authorized source reports are readable"');
    expect(sql).toContain("not public.can_manage_investment_opportunity");
  });
  it("logs safe authorization metadata without financial projections",()=>{
    const runtime=source("src/app/actions/investment-opportunity-runtime.ts");
    expect(runtime).toContain("investment_authorization_decision");
    expect(runtime).toContain("requestId");
    expect(runtime).not.toMatch(/recommendation|financials|purchasePrice|resultSnapshot/);
  });
});
