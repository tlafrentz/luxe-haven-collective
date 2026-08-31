import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(
  "supabase/migrations/20260830120000_fs_ux_005_design_workspaces_budgets.sql",
  "utf8",
);
describe("FS-UX-005 forward migration", () => {
  it("extends the canonical project instead of creating a parallel workspace", () => {
    expect(sql).toContain("alter table public.furnishing_projects");
    expect(sql).not.toContain("create table public.design_workspaces");
  });
  it("supports furnishing-only enrollment without HPM", () => {
    expect(sql).toContain("'furnishing','enabled','studio'");
    expect(sql).not.toMatch(/'hpm','enabled'/);
  });
  it("applies only approved package snapshots and same-workspace products", () => {
    expect(sql).toContain(
      "fp.workspace_id=w and fp.lifecycle_status='approved'",
    );
    expect(sql).toContain("source_package_snapshot_id");
  });
  it("creates linked immutable design and budget evidence", () => {
    expect(sql).toContain("fsux5_approval_snapshots");
    expect(sql).toContain("fsux5_snapshot_immutable");
    expect(sql).toContain("customer_approval_event_id");
  });
  it("prepares only an inert procurement handoff", () => {
    expect(sql).toContain("'prepared_only',true");
    expect(sql).toContain("'external_effects',false");
    expect(sql).not.toMatch(
      /insert into public\.furnishing_procurement_(items|orders)/,
    );
  });
  it("uses RLS, fixed search paths, and denied direct writes", () => {
    expect(sql).toContain("enable row level security");
    expect(sql.match(/set search_path=public/g)?.length).toBeGreaterThanOrEqual(
      4,
    );
    expect(sql).toContain("revoke all on public.fsux5_design_versions");
  });
});
