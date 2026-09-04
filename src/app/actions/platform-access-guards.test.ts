import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const foundation = () => readFile("supabase/migrations/20260903030000_pa001_platform_access_foundation.sql", "utf8");
const evaluatorRpcs = () => readFile("supabase/migrations/20260903031000_pa001_platform_access_evaluator_rpcs.sql", "utf8");

describe("PA-001 platform access foundation guards", () => {
  it("keeps the audit tables append-only and write-locked to the governed RPCs only", async () => {
    const sql = await foundation();
    expect(sql).toContain("pa001_reject_audit_mutation");
    expect(sql).toContain("before update or delete on public.authorization_audit");
    expect(sql).toContain("before update or delete on public.access_change_events");
    expect(sql).toContain("revoke insert, update, delete on public.privilege_definitions, public.roles,\n  public.role_privileges, public.role_assignments from public, anon, authenticated;");
  });

  it("enforces the five-role ceiling and workspace-wide role shape at the schema level", async () => {
    const sql = await foundation();
    expect(sql).toContain("canonical_name in ('workspace_owner','administrator','manager','contributor','viewer')");
    expect(sql).toContain("pa001_role_assignment_shape_guard");
    expect(sql).toContain("PA_ROLE_ASSIGNMENT_MODULE_REQUIRED");
  });

  it("makes duplicate active role assignments idempotent via a partial unique index", async () => {
    const sql = await foundation();
    expect(sql).toContain("role_assignments_active_tuple_idx");
    expect(sql).toContain("where state = 'active'");
  });

  it("does not bridge legacy Operator/Contributor/Viewer memberships in the foundation backfill", async () => {
    const sql = await foundation();
    expect(sql).toContain("where m.role in ('owner','administrator') and m.status = 'active'");
  });

  it("keeps the canonical evaluator read-only (stable, no writes)", async () => {
    const sql = await evaluatorRpcs();
    expect(sql).toMatch(/create or replace function public\.evaluate_privilege\([^)]*\)\s*returns table[\s\S]*?\)\s*language plpgsql stable security definer/);
  });

  it("keeps the last-Workspace-Owner and self-escalation guards in the governed RPCs", async () => {
    const sql = await evaluatorRpcs();
    expect(sql).toContain("PA_ASSIGNMENT_LAST_OWNER_PROTECTED");
    expect(sql).toContain("PA_ASSIGNMENT_SELF_ESCALATION_DENIED");
    expect(sql).toContain("PA_ASSIGNMENT_SELF_REVOKE_DENIED");
    expect(sql).toContain("PA_ASSIGNMENT_OWNER_GRANT_RESTRICTED");
  });

  it("serializes revoke/expire on the workspace alone, not the individual assignment", async () => {
    const sql = await evaluatorRpcs();
    expect(sql).toContain("pg_advisory_xact_lock(hashtextextended('pa-owner-guard:' || v_row.workspace_id::text, 0))");
  });

  it("locks expire_stale_role_assignments to service_role only", async () => {
    const sql = await evaluatorRpcs();
    expect(sql).toContain("revoke all on function public.expire_stale_role_assignments() from public,anon,authenticated;");
    expect(sql).toContain("grant execute on function public.expire_stale_role_assignments() to service_role;");
  });
});
