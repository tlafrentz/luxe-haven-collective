import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260902011000_fs_ux_009_genuine_admin_provisioning.sql",
  "utf8",
).toLowerCase();

describe("FS-UX-009 genuine administrator provisioning boundary", () => {
  it("uses canonical immutable identity authority instead of administrator email text", () => {
    expect(sql).toContain("admin_profile.id=p_admin_id");
    expect(sql).toContain("admin_profile.role='admin'");
    expect(sql).toContain("join auth.users admin_identity");
    expect(sql).toContain("admin_identity.deleted_at is null");
    expect(sql).toContain("admin_identity.banned_until is null");
    expect(sql).not.toContain("a.email like 'fs008g-c8-admin-");
    expect(sql).not.toContain("admin_profile.email like 'fs008g-c8-admin-");
  });

  it("retains the service-only executor and controlled owner identity contract", () => {
    expect(sql).toContain("auth.role()<>'service_role'");
    expect(sql).toContain("fs008g_fixture_service_role_required");
    expect(sql).toContain("owner_profile.email like 'fs008g-c8-owner-%@example.invalid'");
    expect(sql).toContain("revoke all on function public.provision_fs008g_c8_controlled_tenant");
    expect(sql).toContain("from public,anon,authenticated");
    expect(sql).toContain("to service_role");
  });

  it("removes the repeated synthetic administrator email policy from governed cleanup", () => {
    expect(sql).toContain("cleanup_fs008g_c8_controlled_tenant(uuid,uuid,uuid,uuid,uuid)");
    expect(sql).toContain("fs008g_cleanup_admin_policy_source_drift");
    expect(sql).toContain("admin_identity.id=a.id");
    expect(sql).toContain("admin_identity.deleted_at is null");
    expect(sql).toContain("admin_identity.banned_until is null");
  });

  it("serializes provisioning and distinguishes replay from substitution", () => {
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("for update");
    expect(sql).toContain("'already_provisioned'");
    expect(sql).toContain("fs008g_fixture_provisioning_conflict");
    expect(sql).toContain("existing_tenant.approved_by<>p_admin_id");
  });
});
