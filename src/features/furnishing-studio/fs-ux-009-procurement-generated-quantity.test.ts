import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260830163000_fs_ux_009_procurement_generated_quantity.sql",
  "utf8",
);
const remainingLifecycle = [
  "supabase/migrations/20260830130000_fs_ux_006_procurement_readiness.sql",
  "supabase/migrations/20260830140000_fs_ux_007_delivery_installation_tracking.sql",
  "supabase/migrations/20260830161000_fs_ux_009_remaining_path_integration_fixes.sql",
].map((path) => readFileSync(path, "utf8")).join("\n");

describe("FS-UX-009 procurement generated quantity", () => {
  it("omits the generated column from baseline line writes", () => {
    expect(migration).toContain("planned_quantity,\n    existing_inventory_quantity");
    expect(migration).not.toMatch(/set\s+procurement_quantity\s*=/i);
    expect(migration).not.toMatch(
      /insert into public\.furnishing_procurement_lines\s*\([^)]*procurement_quantity/i,
    );
  });

  it("returns the database-derived quantity for create and replay", () => {
    expect(migration.match(/'procurementQuantity',line\.procurement_quantity/g)).toHaveLength(2);
    expect(migration).toContain("'status','created'");
    expect(migration).toContain("'status','replayed'");
  });

  it("preserves snapshot, authorization, idempotency, and audit boundaries", () => {
    for (const contract of [
      "PROCUREMENT_ADMIN_REQUIRED",
      "assert_fs008g_procurement_mutation_enabled",
      "PROCUREMENT_AUTHORITATIVE_SNAPSHOT_REQUIRED",
      "PROCUREMENT_SOURCE_SCOPE_INVALID",
      "PROCUREMENT_SOURCE_VERSION_STALE",
      "PROCUREMENT_BASELINE_REPLAY_CONFLICT",
      "procurement_baseline_generated",
      "'externalEffects',false",
    ]) {
      expect(migration).toContain(contract);
    }
  });

  it("finds no other generated-column assignment downstream", () => {
    expect(remainingLifecycle).not.toMatch(/set\s+procurement_quantity\s*=/i);
    expect(remainingLifecycle).not.toMatch(
      /insert into public\.furnishing_procurement_lines\s*\([^)]*procurement_quantity/i,
    );
  });
});
