import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260811010000_rp001a_reporting_foundation.sql"), "utf8").toLowerCase();
describe("RP-001A persistence", () => {
  it("creates logical reports and immutable version snapshots", () => { expect(sql).toContain("create table public.canonical_reports"); expect(sql).toContain("create table public.canonical_report_versions"); expect(sql).toContain("unique(report_id,version_number)"); expect(sql).toContain("prevent_ready_report_version_mutation"); });
  it("enables tenant and property RLS with no anonymous grants", () => { expect(sql).toContain("alter table public.canonical_reports enable row level security"); expect(sql).toContain("active_workspace_role(workspace_id)is not null"); expect(sql).toContain("can_access_workspace_property(property_id)"); expect(sql).not.toContain("to anonymous"); });
  it("adds no generation, scheduling, export, or delivery infrastructure", () => { expect(sql).not.toContain("cron.schedule"); expect(sql).not.toContain("report_generation_job"); expect(sql).not.toContain("pdf"); expect(sql).not.toContain("csv"); });
});
