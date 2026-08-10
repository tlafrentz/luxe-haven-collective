import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260810030000_au001c_governed_execution.sql"), "utf8");
describe("AU-001C governed execution migration", () => {
  it("creates canonical governed execution persistence", () => { for (const table of ["automation_runs", "automation_run_steps", "automation_execution_attempts", "automation_policy_decisions", "automation_approval_requests", "automation_approval_dispositions", "automation_reconciliations", "automation_execution_activity"]) expect(sql).toContain(`create table public.${table}`); });
  it("enables RLS for every governed table", () => { expect((sql.match(/enable row level security/g) ?? []).length).toBe(8); });
  it("keeps materialization and claims service-only", () => { expect(sql).toContain("revoke all on function public.materialize_automation_run"); expect(sql).toContain("grant execute on function public.materialize_automation_run(jsonb,jsonb,jsonb) to service_role"); expect(sql).toContain("revoke all on function public.claim_automation_run_step"); });
  it("enforces logical run and command uniqueness", () => { expect(sql).toContain("unique(workspace_id,run_request_id)"); expect(sql).toContain("unique(workspace_id,deterministic_command_id)"); expect(sql).toContain("unique(workspace_id,idempotency_key)"); });
  it("makes financial-style history append-only", () => { expect(sql).toContain("automation_attempts_append_only"); expect(sql).toContain("automation_approval_dispositions_append_only"); expect(sql).toContain("automation_execution_activity_append_only"); });
});
