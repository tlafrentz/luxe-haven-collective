import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260720230000_platform_action_persistence.sql"), "utf8");
describe("PF-009 Platform Action persistence architecture", () => {
  it("defines the aggregate and append-oriented tables", () => {
    for (const table of ["platform_actions", "platform_action_assignments", "platform_action_sources", "platform_action_history", "platform_action_outcome_references"]) expect(migration).toContain(`create table public.${table}`);
  });
  it("enables RLS and scopes access through workspace membership", () => {
    expect(migration).toContain("can_access_platform_action_workspace");
    expect(migration.match(/enable row level security/g)).toHaveLength(6);
    expect(migration).toContain("where action_row.workspace_id = p_workspace_id");
  });
  it("provides transactional writes, optimistic concurrency, and append-only protection", () => {
    expect(migration).toContain("platform_action_add"); expect(migration).toContain("platform_action_replace"); expect(migration).toContain("for update"); expect(migration).toContain("current_row.version <> p_expected_version"); expect(migration).toContain("prevent_platform_action_append_only_change");
  });
});
