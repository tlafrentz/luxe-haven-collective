import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20260828034000_fs008g_server_command_contexts.sql", "utf8");
const boundary = readFileSync("src/features/furnishing-studio/server-command-context.ts", "utf8");

describe("FS-008G Furnishing server command context", () => {
  it("resolves workspace targets from the canonical owner aggregate", () => {
    expect(boundary).toContain('.from("owners")');
    expect(boundary).toContain('.select("id")');
    expect(boundary).not.toContain(
      '.from("furnishing_activation_workspaces")',
    );
  });
  it("binds candidate, workflow, tenant, target, command, actor and expiry", () => {
    for (const value of ["candidate_commit","workflow","workspace_id","actor_id","command_type","target_type","target_id","expires_at"]) expect(sql).toContain(value);
    expect(sql).toContain("binding_hash text not null unique");
    expect(sql).toContain("idempotency_key text not null unique");
  });
  it("is service-only and rejects invalid actors, expiry and retirement", () => {
    expect(sql).toContain("FS008G_CONTEXT_ACTOR_INVALID");
    expect(sql).toContain("FS008G_CONTEXT_EXPIRY_INVALID");
    expect(sql).toContain("FS008G_CONTEXT_RETIRED");
    expect(sql).toContain("grant execute on function");
    expect(sql).toContain("to service_role");
  });
  it("re-resolves actor and authoritative target at execution", () => {
    expect(boundary).toContain("requireUser()");
    expect(boundary).toMatch(/authoritativeWorkspace\(\s*context\.targetType,\s*context\.targetId/);
    expect(boundary).toContain("FS008G_CONTEXT_TARGET_MISMATCH");
    expect(boundary).toContain("FS008G_CONTEXT_CANDIDATE_MISMATCH");
    expect(boundary).not.toContain("service_role");
  });
});
