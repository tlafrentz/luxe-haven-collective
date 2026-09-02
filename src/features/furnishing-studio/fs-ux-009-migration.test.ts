import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260830152000_fs_ux_009_controlled_fixture_service_grants.sql",
  "utf8",
);
const cleanup = readFileSync(
  "scripts/verification/cleanup-fs008g-c8-local-identities.ts",
  "utf8",
);

describe("FS-UX-009 controlled fixture service grants", () => {
  it("grants only the DML needed by governed provisioning and cleanup", () => {
    expect(sql).toContain("grant select, insert, update, delete");
    expect(sql).toContain("public.customer_accounts");
    expect(sql).toContain("public.customer_account_memberships");
    expect(sql).toContain("public.commercial_entitlements");
    expect(sql).toContain("to service_role");
    expect(sql).not.toMatch(/\b(?:anon|authenticated)\b/);
  });

  it("is forward-only and leaves protected migrations untouched", () => {
    expect(sql).not.toMatch(/^\s*(?:drop|alter|update|delete\s+from)\b/im);
    expect(20260830152000).toBeGreaterThan(20260830151000);
  });
});

describe("FS-UX-009 controlled fixture cleanup ordering", () => {
  it("removes provisioned dependencies before both synthetic workspaces", () => {
    const compact = cleanup.replace(/\s+/g, " ");
    const style = compact.indexOf('remove( "furnishing_style_systems"');
    const property = compact.indexOf('remove("properties"');
    const workspace = compact.indexOf(
      'remove("owners", "id", fixture.workspaceId)',
    );
    expect(style).toBeGreaterThan(-1);
    expect(property).toBeGreaterThan(style);
    expect(workspace).toBeGreaterThan(property);
    expect(cleanup).toContain(
      'remove("owners", "id", fixture.wrongWorkspaceId)',
    );
  });

  it("closes and removes an unbound pre-lifecycle designation", () => {
    const compact = cleanup.replace(/\s+/g, " ");
    expect(cleanup).toContain("furnishing_controlled_fixture_designations");
    expect(cleanup).toContain("cleaned_at:");
    expect(cleanup).toContain("revoked_at:");
    expect(cleanup).toContain('.is("project_id", null)');
    expect(compact).toContain(
      'remove( "furnishing_controlled_fixture_designations"',
    );
  });
});
