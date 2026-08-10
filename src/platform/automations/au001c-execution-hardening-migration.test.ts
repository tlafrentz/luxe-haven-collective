import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260810040000_au001c_execution_hardening.sql"), "utf8");
describe("AU-001C execution hardening migration", () => {
  it("binds approved runs to durable approval records", () => { expect(sql).toContain("add column approval_id"); expect(sql).toContain("Approval binding mismatch"); });
  it("serializes concurrency groups transactionally", () => { expect(sql).toContain("pg_advisory_xact_lock"); expect(sql).toContain("concurrency_group"); });
  it("supports lease heartbeat and outcome-checked reclaim", () => { expect(sql).toContain("heartbeat_automation_run_step"); expect(sql).toContain("reclaim_expired_automation_run_step"); expect(sql).toContain("if not p_outcome_checked"); });
  it("durably marks dispatch before external transport", () => { expect(sql).toContain("mark_automation_step_dispatching"); expect(sql).toContain("status='leased'"); });
});
