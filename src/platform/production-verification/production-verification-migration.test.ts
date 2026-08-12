import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20260811100000_ca001f_production_verification.sql", "utf8");
const tables = ["production_verification_plans", "production_verification_scenarios", "production_verification_evidence_definitions", "production_release_candidates", "production_verification_runs", "production_verification_instances", "production_verification_attempts", "controlled_verification_identities", "production_verification_resources", "production_verification_evidence", "production_verification_manual_observations", "production_verification_gate_evaluations", "production_verification_audit_events"];

describe("CA-001F migration", () => {
  it("enables RLS and denies anonymous/customer mutation for every table", () => {
    for (const table of tables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toMatch(new RegExp(`revoke all[\\s\\S]*public\\.${table}`));
    }
    expect(sql).not.toMatch(/policy .* for (insert|update|delete)/i);
  });
  it("persists references rather than duplicated CA-001A-E or product data", () => {
    expect(sql).not.toMatch(/create table public\.(commercial_agreements|customer_accounts|entitlements|onboarding_cases|first_value_journeys|activation_assignments|guidebooks)/);
    expect(sql).not.toMatch(/credential|secret|signed_url|raw_payload|email|address|budget|filename/i);
  });
  it("enforces one active run, attempt, and exact resource identity", () => {
    expect(sql).toContain("production_verification_active_run_uidx");
    expect(sql).toContain("production_verification_active_attempt_uidx");
    expect(sql).toContain("unique(verification_run_id,owning_domain_code,resource_type_code,opaque_resource_id)");
  });
});
