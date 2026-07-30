import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20260730030000_wi003f_market_snapshot_lineage.sql", "utf8");
describe("WI-003F canonical market lineage migration", () => {
  it("adds restrictive canonical references to tokens, analyses, and scenarios", () => {
    expect(sql).toContain("investment_analysis_save_tokens");
    expect(sql).toContain("investment_opportunity_analyses");
    expect(sql).toContain("investment_scenarios");
    expect(sql).toMatch(/market_snapshot_id uuid references public\.str_market_snapshots\(id\) on delete restrict/g);
    expect(sql).toContain("subject_property_snapshot_id text references public.property_snapshots(id) on delete restrict");
  });
  it("prevents persisted scenario lineage mutation", () => {
    expect(sql).toContain("Canonical market lineage is immutable");
    expect(sql).toContain("investment_scenario_market_lineage_immutable");
  });
});
