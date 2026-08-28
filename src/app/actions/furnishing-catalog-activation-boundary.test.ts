import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const access = readFileSync(
  "src/app/actions/furnishing-catalog-activation.ts",
  "utf8",
);
const catalog = readFileSync("src/app/actions/furnishing-catalog.ts", "utf8");
const view = readFileSync(
  "src/components/furnishing/product-catalog-workspace.tsx",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20260827030000_fs008g_catalog_authorization_boundary.sql",
  "utf8",
);
const c3 = readFileSync(
  "supabase/migrations/20260828011000_fs008g_c3_atomic_catalog_import.sql",
  "utf8",
);

describe("FS-008G controlled catalog mutation boundary", () => {
  it("requires the exact controlled workspace at the Admin import surface", () => {
    expect(view).toContain("Controlled workspace ID");
    expect(view).toContain('name="workspaceId"');
    expect(view).toContain("Canonical controlled workspace UUID");
    expect(catalog).toContain('text(formData, "workspaceId")');
    expect(catalog).toContain("workspaceId,");
  });

  it("revalidates every activation layer through ordinary authenticated reads", () => {
    expect(access).toContain("createClient()");
    expect(access).toContain(
      "authorize_controlled_furnishing_catalog_mutation",
    );
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("public.is_admin()");
    expect(migration).toContain("workspace_row.workspace_id=p_workspace_id");
    expect(migration).toContain("capability_row.capability='catalog_viewing'");
    for (const guard of [
      "global_kill_switch",
      "global_state",
      "configuration_valid",
      "kill_switch",
      "workspace.cohort<>'internal'",
      "revoked_at",
      "expires_at",
      "capability.enabled",
    ])
      expect(migration).toContain(guard);
    expect(access).not.toContain("createAdminClient");
    expect(migration).toContain("PS001D_VERIFICATION_ONLY_NON_CUSTOMER");
    expect(migration).toContain("grant execute on function");
  });

  it("binds parse and reviewed import to the same workspace and fails closed", () => {
    expect(catalog).toMatch(
      /startCatalogImportAction[\s\S]+assertFurnishingCatalogMutationAllowed\(workspaceId\)/,
    );
    expect(catalog).toMatch(
      /completeCatalogImportAction[\s\S]+select\("workspace_id,status"\)[\s\S]+assertFurnishingCatalogMutationAllowed/,
    );
    expect(catalog).toContain('importTarget.status !== "review_required"');
    expect(access).toContain(
      'throw new Error("FURNISHING_ACTIVATION_DISABLED")',
    );
  });

  it("discovers governed workbook headers and never offers a zero-row import", () => {
    expect(catalog).toContain('value === "source url"');
    expect(catalog).toContain('value === "unit price"');
    expect(catalog).toContain('value === "room"');
    expect(catalog).toContain("mapping.rowNumber + 1");
    expect(catalog).toContain("mapping.rowNumber !== 4");
    expect(catalog).toContain("proposals.length !== 110");
    expect(catalog).toContain("canonicalExtendedCostMinor");
    expect(catalog).toContain("cachedExtendedCostIgnored");
    expect(view).toContain(
      'catalogImport.status === "review_required" && items.length > 0',
    );
  });

  it("commits exactly 110 parsed rows atomically and fails replays closed", () => {
    expect(catalog).toContain("commit_fs008g_c3_catalog_import");
    expect(catalog).toContain("fail_fs008g_c3_catalog_import");
    expect(catalog).toContain(
      "ba849761b7c54060a8e6a7c656c57e03a33a234dfe4233c1fb17902e1e304823",
    );
    expect(c3).toContain("FS008G_C3_REPLAY_CONFLICT");
    expect(c3).toContain("n<>110");
    expect(c3).toContain("'review_required',110");
    expect(c3).toContain("'failed',0,code");
    expect(c3).not.toContain("furnishing_products");
    expect(c3).not.toContain("furnishing_product_offers");
  });
});
