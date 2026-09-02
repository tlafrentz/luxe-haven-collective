import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260830162000_fs_ux_009_package_plan_eligibility.sql",
  "utf8",
);
const actions = readFileSync(
  "src/app/actions/furnishing-project-workspace.ts",
  "utf8",
);

describe("FS-UX-009 package and plan eligibility", () => {
  it("filters discovery by current approved package and required-item eligibility", () => {
    expect(migration).toContain(
      "package_row.current_version_id=version_row.id",
    );
    expect(migration).toContain("item.required");
    expect(migration).toContain("product.status='approved'");
    expect(migration).toContain("product.retired_at is null");
    expect(migration).toContain("product_version.lifecycle_status='approved'");
    expect(migration).toContain("assignment.revoked_at is null");
    expect(migration).toContain("offer.status='active'");
    expect(migration).toContain("offer.availability='in_stock'");
  });

  it("locks and rejects a specific ineligible package item before generation", () => {
    const eligibility = migration.indexOf(
      "FURNISHING_PLAN_PACKAGE_ITEM_INELIGIBLE",
    );
    const generation = migration.indexOf(
      "generated:=public.generate_authorized_furnishing_plan_pre_eligibility",
    );
    expect(eligibility).toBeGreaterThan(0);
    expect(generation).toBeGreaterThan(eligibility);
    expect(migration).toContain("order by composition.id for share");
    expect(actions).toContain(
      "FURNISHING_PLAN_PACKAGE_ITEM_INELIGIBLE:[0-9a-f-]{36}",
    );
  });

  it("binds generated selections to the validated approved product version", () => {
    expect(migration).toContain("set product_version_id=(select version.id");
    expect(migration).toContain(
      "FURNISHING_PLAN_PRODUCT_VERSION_PERSISTENCE_FAILED",
    );
    expect(migration).not.toMatch(/replacement_product_id|substitut/i);
  });

  it("keeps historical package and approval evidence unchanged", () => {
    expect(migration).not.toMatch(
      /update public\.furnishing_(packages|package_versions|package_governance_approvals)/,
    );
    expect(migration).not.toMatch(
      /delete from public\.furnishing_(packages|package_versions|package_governance_approvals)/,
    );
  });
});
