import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260810010000_au001a_automation_foundation.sql"), "utf8");
describe("AU-001A automation foundation migration", () => {
  it("persists only definitions, immutable versions, and activity", () => {
    expect(sql).toContain("create table public.automation_definitions");
    expect(sql).toContain("create table public.automation_definition_versions");
    expect(sql).toContain("create table public.automation_definition_activity");
    expect(sql).not.toMatch(/create table public\.automation_(runs|steps|attempts|approvals|trigger_occurrences)/);
  });
  it("enables RLS and tenant/property access on every AU-001A table", () => {
    for (const table of ["automation_definitions", "automation_definition_versions", "automation_definition_activity"]) expect(sql).toContain(`alter table public.${table} enable row level security`);
    expect(sql).toContain("public.can_access_automation_properties(workspace_id,property_ids)");
    expect(sql).toContain("public.active_workspace_role(workspace_id)in('owner','administrator','operator')");
  });
  it("uses an atomic optimistic-concurrency RPC and append-only history", () => {
    expect(sql).toContain("function public.save_automation_definition");
    expect(sql).toContain("for update");
    expect(sql).toContain("errcode='40001'");
    expect(sql).toContain("automation_definition_versions_append_only");
    expect(sql).toContain("automation_definition_activity_append_only");
    expect(sql).toContain("grant select on public.automation_definitions");
    expect(sql).not.toContain("grant select,insert,update on public.automation_definitions to authenticated");
  });
  it("reuses the existing notification outbox without introducing delivery", () => {
    expect(sql).toContain("execute_notification_outbox_entity_type_check");
    expect(sql).toContain("'automation-definition'");
    expect(sql).not.toMatch(/send_(email|sms|slack|teams)|http_request/i);
  });
});
