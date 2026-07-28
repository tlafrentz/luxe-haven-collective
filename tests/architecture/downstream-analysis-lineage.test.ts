import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";
const source=(path:string)=>readFileSync(path,"utf8");

describe("SA-001E downstream analysis lineage",()=>{
  it("requires composite scenario and report foreign keys to canonical versions",()=>{
    const sql=source("supabase/migrations/20260727020000_saved_analysis_canonical_recovery.sql");
    expect(sql).toContain("investment_scenarios_source_analysis_fk");
    expect(sql).toContain("generated_reports_analysis_version_fk");
    expect(sql).toContain("generated_reports_investment_lineage_required");
    expect(sql).toContain("investment_opportunity_activity_analysis_version_fk");
    expect(sql).toContain("on delete restrict");
  });
  it("requires an explicit scenario source and never resolves current analysis",()=>{
    const sql=source("supabase/migrations/20260727020000_saved_analysis_canonical_recovery.sql");
    const fn=sql.slice(sql.indexOf("create or replace function public.create_investment_scenario"),sql.indexOf("-- Preferred scenario"));
    expect(fn).toContain("p_source_analysis_version_id");
    expect(fn).not.toContain("o.current_analysis_id");
    const action=source("src/app/actions/investment-scenario-runtime.ts");
    expect(action).toContain("p_source_analysis_version_id:sourceAnalysisVersionId");
  });
  it("requires exact report lineage and provides reverse navigation",()=>{
    const reporting=source("src/app/actions/reporting.ts");
    expect(reporting).toContain('if(!analysisVersionId)throw new Error("report_source_not_ready")');
    expect(reporting).not.toMatch(/if\(!analysisVersionId\).*current_analysis_id/);
    expect(source("src/app/(dashboard)/dashboard/reports/[reportId]/page.tsx")).toContain("its source analysis");
    expect(source("src/features/investment-opportunity/components/investment-scenario-workspace.tsx")).toContain("Open source analysis");
  });
});
