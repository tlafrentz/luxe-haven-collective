import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const migration = readFileSync("supabase/migrations/20260730210000_investment_reports_v1.sql", "utf8");
const action = readFileSync("src/app/actions/investment-reports.ts", "utf8");
const navigation = readFileSync("src/features/investment-intelligence/components/investment-workspace-shell-navigation.tsx", "utf8");

describe("Investment Reports v1 boundaries", () => {
  it("persists atomically with immutable lineage and idempotency", () => {
    expect(migration).toContain("generate_investment_report_v1");
    expect(migration).toContain("generated_reports_investment_v1_idempotency_uidx");
    expect(migration).toContain("analysis_version_id");
    expect(action).toContain("readImmutableAnalysis");
    expect(action).toContain("buildInvestmentReportSnapshot");
  });
  it("enforces authenticated owner access and denies anonymous access", () => {
    expect(migration).toContain("v_user uuid:=auth.uid()");
    expect(migration).toContain("owner_profile_id=auth.uid()");
    expect(migration).toContain("grant execute on function public.generate_investment_report_v1");
    expect(migration).not.toMatch(/grant (insert|update|delete) on public\.generated_reports to authenticated/);
  });
  it("supports only archive and restore without deleting snapshots", () => {
    expect(migration).toContain("transition_investment_report_v1");
    expect(migration).not.toMatch(/delete from public\.generated_reports/);
  });
  it("uses the approved Investment navigation order", () => {
    expect([...navigation.matchAll(/label: "([^"]+)"/g)].map(match => match[1])).toEqual(["Analyze", "Scenarios", "Opportunities"]);
  });
});
