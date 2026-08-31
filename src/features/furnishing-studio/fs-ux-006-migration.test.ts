import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20260830130000_fs_ux_006_procurement_readiness.sql", "utf8");

describe("FS-UX-006 forward migration", () => {
  it("extends the canonical procurement baseline from an approved design handoff", () => {
    expect(sql).toContain("alter table public.furnishing_procurement_baselines");
    expect(sql).toContain("source_kind='design_approval'");
    expect(sql).toContain("fsux5_handoff_id");
    expect(sql).not.toContain("create table public.procurement_projects");
  });
  it("preserves exact selection, product-version, and allocation lineage", () => {
    expect(sql).toContain("source_design_snapshot_id");
    expect(sql).toContain("product_version_id");
    expect(sql).toContain("fsux6_line_allocations");
    expect(sql).toContain("unique(readiness_version_id,source_selection_id)");
  });
  it("keeps readiness approval non-executing and separate from authorization", () => {
    expect(sql).toContain("'noOrderPlaced',true");
    expect(sql).toContain("'purchase_authorized',false");
    expect(sql).not.toMatch(/insert into public\.furnishing_(purchase_batches|procurement_orders)/);
  });
  it("uses immutable snapshots, optimistic versions, and replay keys", () => {
    expect(sql).toContain("PROCUREMENT_READINESS_SNAPSHOT_IMMUTABLE");
    expect(sql).toContain("optimistic_version");
    expect(sql).toContain("idempotency_key");
  });
  it("extends service-only controlled cleanup and retains evidence", () => {
    expect(sql).toContain("cleanup_fs008g_synthetic_project_pre_fsux6");
    expect(sql).toContain("retainedReadinessSnapshots");
    expect(sql).toContain("grant execute on function public.cleanup_fs008g_synthetic_project(jsonb)");
    expect(sql).toContain("to service_role");
  });
  it("applies RLS, fixed search paths, and denied direct writes", () => {
    expect(sql.match(/enable row level security/g)?.length).toBeGreaterThanOrEqual(9);
    expect(sql.match(/set search_path=public/g)?.length).toBeGreaterThanOrEqual(8);
    expect(sql).toContain("revoke all on public.fsux6_procurement_versions");
  });
});
