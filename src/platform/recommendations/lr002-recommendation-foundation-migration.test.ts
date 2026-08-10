import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260809025000_lr002_learning_recommendations.sql"), "utf8");

describe("LR-002 Recommendation Foundation migration", () => {
  it("persists recommendation opportunities and immutable versions without duplicating downstream aggregates", () => {
    expect(sql).toContain("create table public.learning_recommendation_opportunities");
    expect(sql).toContain("create table public.learning_recommendation_versions");
    expect(sql).toContain("create table public.learning_recommendation_handoffs");
    expect(sql).not.toMatch(/create table public\.(decisions|actions|measurement_plans|recurring_templates)\b/);
  });

  it("preserves lesson and target-context versions with idempotent processing", () => {
    expect(sql).toContain("primary_lesson_id text references public.learning_lesson_versions");
    expect(sql).toContain("target_context_version integer not null");
    expect(sql).toContain("unique(workspace_id,idempotency_key)");
    expect(sql).toContain("unique(series_id,version)");
  });

  it("enables RLS on every new public table and enforces full property visibility", () => {
    for (const table of ["learning_recommendation_opportunities", "learning_recommendation_versions", "learning_recommendation_sources", "learning_recommendation_applicability", "learning_recommendation_relationships", "learning_recommendation_handoffs", "learning_recommendation_activity"]) expect(sql).toContain(`alter table public.${table} enable row level security`);
    expect(sql).toContain("public.can_access_learning_properties(workspace_id,property_ids)");
  });

  it("reuses the existing notification outbox", () => {
    expect(sql).toContain("execute_notification_outbox_entity_type_check");
    expect(sql).toContain("'recommendation-opportunity','recommendation'");
  });
});
