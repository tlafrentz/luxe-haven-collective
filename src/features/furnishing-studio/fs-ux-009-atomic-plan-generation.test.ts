import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const action = readFileSync(
  "src/app/actions/furnishing-project-workspace.ts",
  "utf8",
);
const component = readFileSync(
  "src/components/furnishing/project-workspace-v1.tsx",
  "utf8",
);
const migration = readFileSync(
  "supabase/migrations/20260830160000_fs_ux_009_atomic_plan_generation.sql",
  "utf8",
);

describe("FS-UX-009 atomic plan generation boundary", () => {
  it("uses one authenticated RPC and consumes its authoritative result", () => {
    const boundary = action.slice(
      action.indexOf("export async function generateFurnishingPlanAction"),
      action.indexOf("async function editableSelection"),
    );
    expect(boundary).toContain("const db = await createClient()");
    expect(boundary).toContain('"generate_authorized_furnishing_plan"');
    expect(boundary).toContain("result?.projectId");
    expect(boundary).toContain("result.planId");
    expect(boundary).toContain("result.projectVersion");
    expect(boundary).not.toContain("createAdminClient");
    expect(boundary).not.toContain('.from("furnishing_plans")');
    expect(boundary).not.toContain('.from("furnishing_projects")');
    expect(component).toContain('name="expectedProjectVersion"');
  });

  it("uses only canonical project lifecycle columns", () => {
    expect(action).not.toMatch(/\bphase\s*:/);
    expect(migration).not.toMatch(/\bphase\b/i);
    expect(migration).toContain("current_plan_version_id=plan_id");
    expect(migration).toContain("plan_status='draft'");
    expect(migration).toContain("lifecycle_status='designing'");
    expect(migration).toContain("optimistic_version=optimistic_version+1");
    expect(migration).toContain(
      "item_row.required,item_row.priority,compatibility,selection_order",
    );
  });

  it("binds authorization, capability, stale state, and idempotency server-side", () => {
    for (const contract of [
      "auth.uid()",
      "active_workspace_role",
      "FURNISHING_PLAN_GLOBAL_SUSPENDED",
      "FURNISHING_PLAN_WORKSPACE_SUSPENDED",
      "FURNISHING_PLAN_CAPABILITY_UNVERIFIED",
      "FURNISHING_PLAN_STALE_PROJECT",
      "FURNISHING_PLAN_IDEMPOTENCY_CONFLICT",
      "pg_advisory_xact_lock",
    ])
      expect(migration).toContain(contract);
    expect(migration).toContain("return prior.result||jsonb_build_object('status','replayed')");
    expect(migration).toContain("to authenticated");
    expect(migration).toContain("from public,anon");
  });

  it("persists immutable command and audit evidence after all business writes", () => {
    const projectUpdate = migration.indexOf(
      "update public.furnishing_projects set current_plan_version_id=plan_id",
    );
    const auditInsert = migration.indexOf(
      "insert into public.furnishing_plan_generation_audit_events",
    );
    const commandInsert = migration.indexOf(
      "insert into public.furnishing_plan_generation_commands",
    );
    expect(projectUpdate).toBeGreaterThan(0);
    expect(auditInsert).toBeGreaterThan(projectUpdate);
    expect(commandInsert).toBeGreaterThan(auditInsert);
    expect(migration).toContain("FURNISHING_PLAN_GENERATION_EVIDENCE_IMMUTABLE");
    expect(migration).toContain("FURNISHING_PLAN_AUDIT_PERSISTENCE_FAILED");
  });
});
