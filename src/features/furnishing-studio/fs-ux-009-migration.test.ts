import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260830152000_fs_ux_009_controlled_fixture_service_grants.sql",
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
