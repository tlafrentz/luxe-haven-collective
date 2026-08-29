import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const action = readFileSync("src/app/actions/furnishing-catalog.ts", "utf8");
const view = readFileSync("src/components/furnishing/product-catalog-workspace.tsx", "utf8");
const sql = readFileSync("supabase/migrations/20260829010000_fs008g_c7_offer_normalization.sql", "utf8");

describe("FS-008G-C7 atomic reviewed catalog apply", () => {
  it("replaces browser row mutation with one canonical transaction", () => {
    const completion = action.slice(action.indexOf("export async function completeCatalogImportAction"), action.indexOf("export async function getCatalogImport"));
    expect(completion).toContain("apply_fs008g_c7_catalog_import");
    expect(completion).not.toContain("for (const item");
    expect(sql).toContain("for update");
    expect(sql).toContain("for item in select");
    expect(sql).not.toContain("exception when");
  });

  it("binds authoritative target, version, correlation and stable replay identity", () => {
    expect(view).toContain('name="commandContextId"');
    expect(action).toContain("context.workspaceId");
    expect(action).toContain("context.idempotencyKey");
    expect(action).toContain("Number(importTarget.optimistic_version)");
    for (const rejection of ["TARGET_MISMATCH", "VERSION_CONFLICT", "CORRELATION_MISMATCH", "REPLAY_CONFLICT"])
      expect(sql).toContain(`FS008G_C7_${rejection}`);
    expect(sql).toContain("apply_fingerprint");
    expect(sql).toContain("optimistic_version=optimistic_version+1");
  });

  it("requires the exact authoritative 110-row workbook and resolved reviews", () => {
    expect(sql).toContain("Catalog Review (1).xlsx");
    expect(sql).toContain("ba849761b7c54060a8e6a7c656c57e03a33a234dfe4233c1fb17902e1e304823");
    expect(sql).toContain("run.total_rows<>110");
    expect(sql).toContain("count(*)");
    expect(sql).toContain("FS008G_C7_UNRESOLVED_REVIEW_ITEM");
  });

  it("fails closed for non-Admin, wrong state, invalid matches and offers", () => {
    for (const rejection of ["ADMIN_REQUIRED", "REVIEW_REQUIRED", "MATCH_TARGET_INVALID", "CREATE_TARGET_INVALID"])
      expect(sql).toContain(`FS008G_C7_${rejection}`);
    expect(sql).toContain("raise exception 'OFFER_TARGET_INVALID'");
    expect(sql).toContain("security definer");
    expect(sql).toContain("revoke all on function");
  });

  it("records one immutable completion activity only after every row succeeds", () => {
    const activityAt = sql.indexOf("catalog_inventory_import_completed");
    const loopAt = sql.indexOf("for item in select");
    expect(activityAt).toBeGreaterThan(loopAt);
    expect(sql).toContain("'failed',0");
    expect(sql).toContain("return jsonb_build_object('status','replayed'");
  });
});
