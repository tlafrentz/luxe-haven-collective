import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260830158000_fs_ux_009_adoption_binding_cleanup.sql",
  "utf8",
).toLowerCase();
const context = readFileSync(
  "src/features/furnishing-studio/server-command-context.ts",
  "utf8",
);
const action = readFileSync(
  "src/app/actions/furnishing-catalog-governance.ts",
  "utf8",
);
const detail = readFileSync(
  "src/components/furnishing/product-catalog-workspace.tsx",
  "utf8",
);

describe("FS-UX-009 adoption command binding", () => {
  it("binds the issued context and action to the authoritative platform product", () => {
    expect(context).toContain('| "platform_product"');
    expect(context).toContain('targetType === "platform_product"');
    expect(detail).toContain('targetType: "platform_product"');
    expect(detail).toContain("targetId: String(product.id)");
    expect(action).toContain('targetType: "platform_product"');
    expect(action).toContain("sourceProductId !== context.targetId");
  });

  it("fingerprints the complete authoritative adoption request", () => {
    for (const value of [
      "'operation','catalog.product.adopt'",
      "'workspaceid',workspace",
      "'sourceproductid',source_id",
      "'workspaceoverrides',overrides",
      "'correlationid',correlation",
      "request_fingerprint",
    ])
      expect(migration).toContain(value);
  });

  it("rejects mismatched key reuse and preserves exact replay", () => {
    expect(migration).toContain("catalog_adoption_idempotency_conflict");
    expect(migration).toContain("adoption.workspace_id<>workspace");
    expect(migration).toContain("adoption.source_product_id<>source_id");
    expect(migration).toContain("adoption.workspace_overrides<>overrides");
    expect(migration).toContain("adoption.correlation_id<>correlation");
    expect(migration).toContain("'status','replayed'");
  });

  it("serializes by key and workspace/source without rewriting history", () => {
    expect(migration).toContain("furnishing-product-adoption-key:");
    expect(migration).toContain("'furnishing-product-adoption:'||workspace::text||':'||source_id::text");
    expect(migration).not.toMatch(/update\s+public\.furnishing_product_adoptions\s+set/);
  });
});

describe("FS-UX-009 controlled adoption cleanup", () => {
  it("locks, validates, and removes each controlled adoption unit in dependency order", () => {
    expect(migration).toContain(
      "where workspace_id=p_workspace_id order by id for update",
    );
    expect(migration).toContain("fs008g_adoption_cleanup_scope_invalid");
    expect(migration).toContain("fs008g_adoption_cleanup_retained_dependency");
    const operations = [
      "delete from public.furnishing_product_offer_assignments",
      "delete from public.furnishing_catalog_approvals",
      "delete from public.furnishing_product_review_events",
      "delete from public.furnishing_product_versions",
      "delete from public.furnishing_product_identity_claims",
      "delete from public.furnishing_catalog_activity",
      "delete from public.furnishing_product_adoptions",
      "delete from public.furnishing_products",
      "delete from public.furnishing_command_contexts",
    ];
    for (let index = 1; index < operations.length; index += 1)
      expect(migration.indexOf(operations[index])).toBeGreaterThan(
        migration.indexOf(operations[index - 1]),
      );
    expect(migration).toContain(
      "delete from public.furnishing_catalog_approvals\n    where workspace_id=p_workspace_id",
    );
  });

  it("deletes only eligible synthetic import products without nulling lineage", () => {
    expect(migration).toContain(
      "p.source_import_id=any(import_ids)\n    and p.scope='platform' and p.workspace_id is null",
    );
    expect(migration).toContain("p.status<>'draft'");
    expect(migration).toContain("p.created_by<>p_admin_id");
    expect(migration).toContain("delete from public.furnishing_products where id=any(platform_product_ids)");
    expect(migration).toContain("delete from public.furnishing_catalog_imports where id=any(import_ids)");
    expect(migration).not.toMatch(/update\s+public\.furnishing_products\s+set\s+source_import_id/);
    expect(migration).toContain(
      "revoke all on function public.cleanup_fs008g_c8_controlled_tenant(uuid,uuid,uuid,uuid,uuid)",
    );
    expect(migration).toContain("to service_role");
    expect(migration).not.toMatch(/to\s+(anon|authenticated)/);
  });

  it("fails closed for protected, cross-workspace, and retained dependencies", () => {
    expect(migration).toContain("p.workspace_id<>p_workspace_id");
    expect(migration).toContain("p.source_type<>'platform_adoption'");
    expect(migration).toContain("p.family_product_id<>a.source_product_id");
    expect(migration).toContain("p.created_by<>p_admin_id");
    expect(migration).toContain("a.adopted_by<>p_admin_id");
    expect(migration).toContain("fs008g_controlled_import_preexisting_product_dependency");
    expect(migration).toContain("fs008g_controlled_platform_product_noncontrolled_adoption");
    expect(migration).toContain("furnishing_product_versions.approved");
    expect(migration).toContain("furnishing_product_offers");
    expect(migration).toContain("externalEffects',false".toLowerCase());
  });

  it("locks the run and removes controlled identities only after dependency cleanup", () => {
    expect(migration).toContain("fsux9-controlled-run-cleanup:");
    expect(migration).toContain("d.created_by<>p_owner_id");
    expect(migration).toContain("order by id for update");
    expect(migration).toContain("delete from public.furnishing_controlled_fixture_designations");
    expect(migration).toContain("delete from public.owners where id in(p_workspace_id,p_wrong_workspace_id)");
    expect(migration).toContain("'status','already_cleaned'");
  });
});
