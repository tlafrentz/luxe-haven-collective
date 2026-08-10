import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260809023000_ex002_outcome_measurement_v1.sql"), "utf8");

describe("EX-002 Outcome Measurement migration", () => {
  it("links canonical Learning measurements to Execute without creating another Action model", () => {
    expect(migration).toContain("source_action_id text");
    expect(migration).toContain("source_action_plan_id text");
    expect(migration).toContain("public.platform_actions action");
    expect(migration).not.toMatch(/create table public\.(tasks|work_items|outcome_measurements)\b/);
  });

  it("keeps immutable plans separate from versioned operational state", () => {
    expect(migration).toContain("create table public.learning_execute_measurement_state");
    expect(migration).toContain("version integer not null default 1");
    expect(migration).toContain("status text not null default 'draft'");
  });

  it("enables RLS and property-aware authorization for every new public table", () => {
    for (const table of ["learning_execute_measurement_state", "learning_measurement_target_amendments", "learning_measurement_baseline_amendments", "learning_measurement_guardrails", "learning_measurement_exceptions"]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain("public.can_access_workspace_property(measurement.property_id)");
    expect(migration).toContain("public.active_workspace_role(measurement.workspace_id) is not null");
  });

  it("reuses Execute activity and notification boundaries", () => {
    expect(migration).toContain("platform_action_activity_entity_type_check");
    expect(migration).toContain("execute_notification_outbox_entity_type_check");
    expect(migration).toContain("'measurement'");
  });
});
