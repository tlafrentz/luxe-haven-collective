import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveFurnishingActivation } from "@/features/furnishing-studio/activation";

const migration = readFileSync("supabase/migrations/20260825010000_fs008a_activation_controls.sql", "utf8");
describe("FS-008A activation controls", () => {
  it("enforces deterministic higher-level precedence", () => {
    const base = { globalKillSwitch:false, globalState:"enabled" as const, workspaceKillSwitch:false, workspaceEnabled:true, cohortEligible:true, capabilityEnabled:true, actorRole:"owner" as const, tenantRelationship:"own" as const, configurationValid:true, policyVersion:"fs008a-v1" };
    expect(resolveFurnishingActivation({ ...base, globalKillSwitch:true }).reason).toBe("killed_globally");
    expect(resolveFurnishingActivation({ ...base, workspaceKillSwitch:true }).reason).toBe("killed_globally");
    expect(resolveFurnishingActivation({ ...base, cohortExpired:true }).reason).toBe("cohort_expired");
  });
  it("creates safe disabled persistence with RLS and no anonymous mutation", () => {
    for (const table of ["furnishing_activation_releases","furnishing_activation_workspaces","furnishing_activation_capabilities","furnishing_activation_audit_events"]) expect(migration).toContain(`alter table public.${table} enable row level security`);
    expect(migration).toContain("global_kill_switch,configuration_valid,reason) values('FS-008A','candidate','fs008a-v1','disabled',true,false");
    expect(migration).toContain("revoke all on public.furnishing_activation_releases");
  });
  it("keeps FS-008B-G effects disabled in this milestone", () => expect(migration).not.toMatch(/insert into public\.(commercial_entitlements|furnishing_projects|commercial_catalog_publications)/i));
});
