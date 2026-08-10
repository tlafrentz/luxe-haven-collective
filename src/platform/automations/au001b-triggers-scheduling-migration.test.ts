import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260810020000_au001b_triggers_scheduling.sql"), "utf8").toLowerCase();

describe("AU-001B trigger persistence migration", () => {
  it("creates every durable control-plane record with RLS in the same migration", () => {
    for (const table of ["automation_triggers", "automation_trigger_occurrences", "automation_run_requests", "automation_scheduler_leases", "automation_scheduler_checkpoints", "automation_trigger_evaluation_state", "automation_backfill_jobs", "automation_trigger_activity"]) {
      expect(migration).toContain(`create table public.${table}`); expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });
  it("enforces occurrence and run-request uniqueness plus immutable version lineage", () => {
    expect(migration).toContain("unique(workspace_id,occurrence_key)"); expect(migration).toContain("unique(workspace_id,occurrence_id)");
    expect(migration).toContain("references public.automation_triggers(workspace_id,automation_id,automation_definition_version,id)");
    expect(migration).toContain("automation_occurrences_append_only"); expect(migration).toContain("automation_run_requests_append_only");
  });
  it("atomically accepts an occurrence and run request without dispatch persistence", () => {
    expect(migration).toContain("function public.accept_automation_trigger_occurrence"); expect(migration).toContain("insert into public.automation_trigger_occurrences"); expect(migration).toContain("insert into public.automation_run_requests");
    expect(migration).not.toContain("command_dispatch"); expect(migration).not.toContain("target_command_queue");
  });
  it("uses service-only bounded leases and generation-bound checkpoints", () => {
    expect(migration).toContain("function public.claim_automation_scheduler_lease"); expect(migration).toContain("function public.heartbeat_automation_scheduler_lease"); expect(migration).toContain("function public.advance_automation_scheduler_checkpoint");
    expect(migration).toContain("grant execute on function public.claim_automation_scheduler_lease"); expect(migration).toContain("to service_role"); expect(migration).toContain("lease_generation");
  });
});
