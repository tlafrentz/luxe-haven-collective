import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(
  "supabase/migrations/20260806061000_fs005_furnishing_project_workspace.sql",
  "utf8",
);
describe("FS-005 migration", () => {
  it("snapshots package design validation and approval", () => {
    expect(sql).toContain("package_snapshot");
    expect(sql).toContain("design_snapshot");
    expect(sql).toContain("approval_snapshot");
  });
  it("supports existing inventory and quantity overrides independently", () => {
    expect(sql).toContain("furnishing_existing_inventory");
    expect(sql).toContain("quantity_override_reason");
  });
  it("tracks optimistic revisions", () =>
    expect(sql.match(/revision bigint/g)?.length).toBeGreaterThanOrEqual(2));
  it("adds workspace-scoped supporting tables", () =>
    expect(sql.match(/enable row level security/g)?.length).toBe(3));
});
