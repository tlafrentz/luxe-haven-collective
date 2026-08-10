import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260809024000_lr001_learn_workspace_v1.sql"), "utf8");

describe("LR-001 Learning Foundation migration", () => {
  it("adds signals and patterns while extending canonical lesson tables", () => {
    expect(sql).toContain("create table public.learning_signals");
    expect(sql).toContain("create table public.learning_patterns");
    expect(sql).toContain("alter table public.learning_candidate_lessons");
    expect(sql).toContain("alter table public.learning_lesson_versions");
    expect(sql).not.toMatch(/create table public\.(recommendations|actions|outcome_measurements)\b/);
  });

  it("makes source processing and pattern evaluation idempotent", () => {
    expect(sql).toContain("unique(workspace_id,source_type,source_record_id,source_version)");
    expect(sql).toContain("unique(workspace_id,idempotency_key)");
    expect(sql).toContain("unique(series_id,version)");
  });

  it("enables RLS and denies partial-property visibility through the shared scope function", () => {
    for (const table of ["learning_signals", "learning_patterns", "learning_pattern_signals"]) expect(sql).toContain(`alter table public.${table} enable row level security`);
    expect(sql).toContain("not exists(select 1 from unnest");
    expect(sql).toContain("not public.can_access_workspace_property(property_id)");
    expect(sql).toContain("public.active_workspace_role(p_workspace_id)is not null");
  });

  it("reuses the provider-neutral notification outbox", () => {
    expect(sql).toContain("execute_notification_outbox_entity_type_check");
    expect(sql).toContain("'learning-signal','pattern','lesson'");
  });
});
