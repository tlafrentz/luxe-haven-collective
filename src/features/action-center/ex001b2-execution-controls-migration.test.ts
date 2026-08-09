import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260809022000_ex001b2_execution_controls.sql",
  "utf8",
);
describe("EX-001B2 execution-control migration", () => {
  it("applies control records, activity, and outbox writes atomically", () => {
    expect(sql).toContain("function public.apply_execute_action_control");
    for (const table of [
      "platform_action_evidence",
      "platform_action_blockers",
      "platform_action_dependencies",
      "platform_action_activity",
      "execute_notification_outbox",
    ])
      expect(sql).toContain(`insert into public.${table}`);
    expect(sql).toContain("for update");
    expect(sql).toContain("p_expected_version");
  });
  it("enforces property-aware RLS and private evidence storage", () => {
    expect(sql.match(/Members manage authorized Execute/g)?.length).toBe(3);
    expect(sql).toContain("public.can_access_workspace_property");
    expect(sql).toContain("'execute-evidence','execute-evidence',false");
    expect(sql).toContain("to authenticated");
  });
  it("preserves evidence review history and structured payloads", () => {
    for (const value of [
      "submitted_at",
      "superseded_by_id",
      "metadata jsonb",
      "rejection_reason",
      "reviewer_id",
    ])
      expect(sql).toContain(value);
    expect(sql).toContain("on delete restrict");
  });
});
