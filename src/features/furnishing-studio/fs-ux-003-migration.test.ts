import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(
  "supabase/migrations/20260830100000_fs_ux_003_inventory_import_workflow.sql",
  "utf8",
);
describe("FS-UX-003 forward migration", () => {
  it("extends existing ledgers without creating parallel import authority", () => {
    expect(sql).toContain("alter table public.furnishing_catalog_imports");
    expect(sql).toContain("alter table public.furnishing_catalog_import_items");
    expect(sql).not.toContain(
      "create table public.furnishing_inventory_imports",
    );
  });
  it("persists versioned stages and private source metadata", () => {
    for (const token of [
      "mapping_version",
      "validation_version",
      "reconciliation_version",
      "source_size_bytes",
      "storage_path",
      "duplicate_source_import_id",
      "furnishing_import_stage_evidence",
    ])
      expect(sql).toContain(token);
    expect(sql).toContain("public=false");
  });
  it("commits platform drafts only and preserves approved products", () => {
    expect(sql).toContain("commit_furnishing_inventory_import");
    expect(sql).toContain("values('platform',null");
    expect(sql).toContain("status='approved'");
    expect(sql).toContain("'proposed'");
    expect(sql).not.toMatch(
      /insert into public\.furnishing_product_adoptions/i,
    );
    expect(sql).not.toMatch(/scope,workspace_id[\s\S]+values\('workspace'/);
  });
  it("is service-only, idempotent, serialized, and free of external effects", () => {
    expect(sql).toContain("auth.role()<>'service_role'");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("idempotency_key");
    expect(sql).toContain("'status','replayed'");
    expect(sql).toContain("'externalEffects',false");
    expect(sql).toContain(
      "revoke all on function public.commit_furnishing_inventory_import(jsonb) from public,anon,authenticated",
    );
    for (const table of [
      "commerce_payments",
      "notifications",
      "furnishing_installation_projects",
    ])
      expect(sql).not.toContain(`insert into public.${table}`);
  });
});
