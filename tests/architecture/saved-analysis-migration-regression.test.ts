import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260727020000_saved_analysis_canonical_recovery.sql",
  ),
  "utf8",
);

describe("SA-001G migration and database enforcement manifest", () => {
  it("SA-001G.06 keeps every save write inside one database function", () => {
    const save = functionBody("save_investment_opportunity");
    expect(save).toContain("insert into public.investment_opportunities");
    expect(save).toContain("insert into public.investment_opportunity_analyses");
    expect(save).toContain("insert into public.investment_opportunity_activity");
    expect(save).toContain("insert into public.investment_opportunity_notes");
    expect(save).toContain("insert into public.investment_opportunity_commands");
    expect(save).toContain("for update");
    expect(save).not.toMatch(/exception[\s\S]*commit/i);
  });

  it("SA-001G.07 rejects conflicting receipts and returns the committed result on retry", () => {
    const save = functionBody("save_investment_opportunity");
    expect(save).toContain("receipt.payload_hash is distinct from p_payload_hash");
    expect(save).toContain("Investment Opportunity command payload conflict");
    expect(save).toContain("return receipt.result||jsonb_build_object('idempotent',true)");
  });

  it("SA-001G.09 removes scenario clones before repairing canonical version numbers", () => {
    const deleteClone = migration.indexOf("delete from public.investment_opportunity_analyses");
    const repairSequence = migration.indexOf(
      "update public.investment_opportunity_analyses set sequence=sequence+1000000",
    );
    expect(deleteClone).toBeGreaterThan(0);
    expect(repairSequence).toBeGreaterThan(deleteClone);
    expect(migration).toContain("SA-001B could not recover legacy scenario lineage");
    expect(migration).toContain("investment_scenarios_source_analysis_fk");
  });

  it("SA-001G.29 enforces source lineage and immutable downstream snapshots", () => {
    expect(migration).toContain(
      "references public.investment_opportunity_analyses(opportunity_id,id) on delete restrict",
    );
    expect(migration).toContain("investment_scenario_lineage_immutable");
    expect(migration).toContain("report_snapshot_immutable");
    expect(migration).toContain("investment_opportunity_activity_analysis_lineage_required");
  });

  it("SA-001G.24 defines RLS through the same read and manage policy functions", () => {
    expect(migration).toContain("can_read_investment_opportunity");
    expect(migration).toContain("can_manage_investment_opportunity");
    for (const relation of [
      "investment_opportunities",
      "investment_opportunity_analyses",
      "investment_opportunity_activity",
      "investment_opportunity_notes",
      "investment_scenarios",
    ]) {
      expect(migration).toContain(`on public.${relation} for select to authenticated`);
    }
  });

  it("SA-001G.28 assembles the complete opportunity bundle in one RPC statement", () => {
    const bundle = functionBody("get_investment_opportunity_bundle");
    for (const member of ["analyses", "activity", "notes", "scenarios", "reports"]) {
      expect(bundle).toContain(`'${member}'`);
    }
    expect(bundle).toContain("can_read_investment_opportunity");
  });
});

function functionBody(name: string): string {
  const start = migration.indexOf(`create or replace function public.${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = migration.indexOf("end $$;", start);
  expect(end).toBeGreaterThan(start);
  return migration.slice(start, end);
}
