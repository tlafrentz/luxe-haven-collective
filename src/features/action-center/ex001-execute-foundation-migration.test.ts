import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20260809020000_ex001_execute_workspace_foundation.sql", "utf8");

describe("EX-001 Execute foundation migration", () => {
  it("extends canonical actions instead of creating a competing task table", () => {
    expect(sql).toContain("alter table public.platform_actions");
    expect(sql).not.toMatch(/create table public\.(tasks|work_items)\b/);
    expect(sql).toContain("foreign key (workspace_id,action_id) references public.platform_actions");
  });

  it("creates plans, dependencies, evidence, recurrence, escalations, and append-only activity", () => {
    for (const table of ["platform_action_plans", "platform_action_dependencies", "platform_action_blockers", "platform_action_evidence", "platform_action_recurrence_templates", "platform_action_occurrences", "platform_action_escalations", "platform_action_activity"]) expect(sql).toContain(`create table public.${table}`);
    expect(sql).toContain("platform_action_activity_append_only");
    expect(sql).toContain("platform_action_occurrences_append_only");
  });

  it("enables RLS and denies anonymous access by omission", () => {
    const tables = ["platform_action_plans", "platform_action_dependencies", "platform_action_blockers", "platform_action_evidence", "platform_action_recurrence_templates", "platform_action_occurrences", "platform_action_escalations", "platform_action_activity"];
    for (const table of tables) expect(sql).toContain(`alter table public.${table} enable row level security`);
    expect(sql).not.toMatch(/\bto anon\b/);
  });
});
