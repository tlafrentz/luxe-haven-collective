import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration=readFileSync("supabase/migrations/20260727020000_saved_analysis_canonical_recovery.sql","utf8");
const scenarios=readFileSync("src/app/actions/investment-scenario-runtime.ts","utf8");
const reporting=readFileSync("src/app/actions/reporting.ts","utf8");

describe("SA-001B canonical persistence boundaries",()=>{
  it("stores scenarios outside analysis version history with immutable source lineage",()=>{
    expect(migration).toContain("source_analysis_version_id");
    expect(migration).toContain("scenario_lineage_immutable");
    expect(migration).not.toMatch(/create or replace function public\.create_investment_scenario[\s\S]*?insert into public\.investment_opportunity_analyses/);
    expect(scenarios).toContain("sourceAnalysisVersionId:row.source_analysis_version_id");
  });

  it("keeps latest analysis and preferred scenario as separate pointers",()=>{
    expect(migration).toContain("preferred_scenario_id");
    const canonicalCreate=migration.slice(migration.lastIndexOf("create or replace function public.create_investment_scenario"));
    expect(canonicalCreate).not.toContain("current_analysis_id=s.scenario_id");
    expect(canonicalCreate).toContain("preferred_scenario_id=s.scenario_id");
  });

  it("commits the initial note before the replayable receipt in one save RPC",()=>{
    const save=migration.slice(migration.indexOf("create or replace function public.save_investment_opportunity("),migration.indexOf("create or replace function public.get_investment_opportunity_bundle"));
    expect(save.indexOf("insert into public.investment_opportunity_notes")).toBeGreaterThan(0);
    expect(save.indexOf("insert into public.investment_opportunity_commands")).toBeGreaterThan(save.indexOf("insert into public.investment_opportunity_notes"));
    expect(save).toContain("'idempotent',true");
    expect(save).toContain("payload_hash is distinct from p_payload_hash");
  });

  it("reads one consistent canonical bundle",()=>{
    expect(migration).toContain("create or replace function public.get_investment_opportunity_bundle");
    for(const key of ["'analyses'","'activity'","'notes'","'scenarios'","'reports'"])expect(migration).toContain(key);
  });

  it("binds every investment report to an immutable analysis version",()=>{
    expect(migration).toContain("generated_reports_analysis_version_fk");
    expect(reporting).toContain("analysis_version_id: scope.analysisVersionId");
    expect(reporting).toContain('type:"investment-analysis-version"');
  });

  it("aligns application and RLS decisions to workspace access helpers",()=>{
    expect(migration).toContain("can_read_investment_opportunity");
    expect(migration).toContain("can_manage_investment_opportunity");
    expect(migration).toContain("active_workspace_role(p_workspace_id)");
  });
});
