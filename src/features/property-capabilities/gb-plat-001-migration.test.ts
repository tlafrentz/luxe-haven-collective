import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260808090000_gb_plat_001_standalone_guidebook_properties.sql",
  "utf8",
);
const repair = readFileSync(
  "supabase/migrations/20260809010000_gb_plat_001_capability_repair.sql",
  "utf8",
);

describe("GB-PLAT-001 persistence", () => {
  it("models product capabilities independently on one canonical property", () => {
    expect(migration).toContain("create table if not exists public.property_capability_enrollments");
    expect(migration).toContain("'guidebook','hpm','furnishing','investment'");
    expect(migration).toContain("unique(property_id, capability)");
    expect(migration).toContain("property_workspace_mismatch");
  });

  it("enables RLS with workspace and property authorization", () => {
    expect(migration).toContain("alter table public.property_capability_enrollments enable row level security");
    expect(migration).toContain("public.active_workspace_role(workspace_id) is not null");
    expect(migration).toContain("public.can_access_workspace_property(property_id)");
    expect(migration).not.toMatch(/grant (insert|update|delete) on public\.property_capability_enrollments to authenticated/i);
  });

  it("does not infer HPM from a generic property record", () => {
    expect(migration).toContain("exists(select 1 from public.external_properties");
    expect(migration).toContain("exists(select 1 from public.bookings");
    expect(migration).not.toMatch(/select distinct p\.owner_id,p\.id,'hpm'[\s\S]*from public\.properties p\s*on conflict/);
  });

  it("supports optional street address and idempotent creation recovery", () => {
    expect(migration).toContain("nullif(trim(p_address),'')");
    expect(migration).toContain("a.command_id=p_command_id");
    expect(migration).toContain("property_created_from_guidebook_flow");
  });

  it("scopes Guidebook Operations by explicit capability", () => {
    expect(migration).toContain("capability.capability='guidebook'");
    expect(migration).toContain("capability.status='enabled'");
  });

  it("has a uniquely versioned production repair for the collided migration", () => {
    expect(repair).toContain("create table if not exists public.property_capability_enrollments");
    expect(repair).toContain("create or replace function public.create_guidebook_flow_property");
    expect(repair).toContain("create or replace function public.list_guidebook_library_page");
    expect(repair).toContain("drop policy if exists");
  });
});
