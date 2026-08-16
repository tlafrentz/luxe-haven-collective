import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260815100000_controlled_guidebook_property_provisioning.sql",
  ),
  "utf8",
).toLowerCase();

describe("controlled Guidebook property migration", () => {
  it("extends the canonical property aggregate and never creates HPM", () => {
    expect(sql).toContain("alter table public.properties");
    expect(sql).toContain("array['guidebook_only']::text[]");
    expect(sql).not.toContain("'hpm','enabled'");
    expect(sql).not.toContain("create table public.controlled_properties");
  });

  it("provides one atomic, actor-preserving provisioning command", () => {
    expect(sql).toContain(
      "function public.provision_guidebook_property_for_customer",
    );
    expect(sql).toContain("v_actor uuid:=auth.uid()");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("property_entitlement_active_grant_uidx");
    expect(sql).toContain("production_verification_resources");
    expect(sql).toContain("workspace_property_system_activity");
  });

  it("fails cleanup closed around production and foreign dependencies", () => {
    expect(sql).toContain("controlled_property_published_or_scheduled_content");
    expect(sql).toContain("controlled_property_non_controlled_guidebook");
    expect(sql).toContain("controlled_property_foreign_dependencies");
    expect(sql).toContain("controlled_property_creation_resources_unresolved");
    expect(sql).toContain("status='released'");
  });
});
