import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260829020000_fs008g_c8a_catalog_package_governance.sql",
  "utf8",
);

describe("FS-008G-C8-A forward migration", () => {
  it("governs workspace requirements, products, offers, and packages", () => {
    expect(sql).toContain("furnishing_requirement_scope_consistent");
    expect(sql).toContain("furnishing_product_scope_consistent");
    expect(sql).toContain("furnishing_catalog_approvals");
    expect(sql).toContain("furnishing_product_offer_assignments");
    expect(sql).toContain("furnishing_one_preferred_offer");
    expect(sql).toContain("OFFER_ASSIGNMENT_NOT_APPROVED");
  });

  it("records validation and immutable approval evidence for both package levels", () => {
    expect(sql).toContain("furnishing_package_validation_runs");
    expect(sql).toContain("furnishing_package_governance_approvals");
    expect(sql).toContain("package_kind in('room','property')");
    expect(sql).toContain("composition_hash");
    expect(sql).toContain("furnishing_property_package_scope_consistent");
    expect(sql).toContain("governance_scope in('workspace','platform','legacy_ambiguous')");
    expect(sql).toContain("FURNISHING_PACKAGE_LEGACY_REVIEW_REQUIRED");
    expect(sql).toContain("validate_controlled_furnishing_package");
    expect(sql).toContain("approve_controlled_furnishing_package");
    expect(sql).toContain("PACKAGE_VALIDATION_REQUIRED");
  });

  it("fails visibility closed to the active internal cohort", () => {
    expect(sql).toContain("fs008g_internal_catalog_visible");
    expect(sql).toContain("r.global_state='internal'");
    expect(sql).toContain("w.cohort='internal'");
    expect(sql).toContain("not w.kill_switch");
    expect(sql.match(/enable row level security/g)).toHaveLength(4);
    expect(sql.match(/Internal cohort reads/g)).toHaveLength(4);
  });

  it("keeps mutations behind authenticated governed RPCs", () => {
    expect(sql).toContain("approve_controlled_furnishing_catalog_target");
    expect(sql).toContain("assign_controlled_furnishing_offer");
    expect(sql).toContain("authorize_controlled_furnishing_catalog_mutation");
    expect(sql).toContain("CATALOG_APPROVAL_REPLAY_CONFLICT");
    expect(sql).toContain("grant execute on function");
  });
});
