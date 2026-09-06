import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const sql = () =>
  readFile(
    "supabase/migrations/20260905010000_fix_investment_scenario_learning_delegate_access.sql",
    "utf8",
  );

describe("scenario comparison/outcome/observation delegate-access fix", () => {
  const scenarioRpcNames = [
    "save_scenario_comparison_session",
    "record_investment_scenario_outcome",
    "add_investment_scenario_observation",
  ];
  async function scenarioRpcBodies() {
    const migration = await sql();
    return migration
      .split(/create or replace function public\./)
      .slice(1)
      .filter((body) => scenarioRpcNames.some((name) => body.startsWith(name)));
  }

  it("checks scenario existence against investment_scenarios, not the purged investment_opportunity_analyses table", async () => {
    const bodies = await scenarioRpcBodies();
    expect(bodies).toHaveLength(3);
    for (const body of bodies) {
      expect(body).toContain(
        "exists(select 1 from public.investment_scenarios",
      );
      expect(body).not.toMatch(
        /investment_opportunity_analyses[\s\S]{0,80}scenario_unavailable/,
      );
    }
  });

  it("upgrades all three RPCs from owner-only to workspace-aware authorization", async () => {
    const bodies = await scenarioRpcBodies();
    expect(bodies).toHaveLength(3);
    for (const body of bodies) {
      expect(body).toContain(
        "public.can_manage_investment_opportunity(o.workspace_id,o.property_id)",
      );
      expect(body).not.toMatch(/owner_id\s*<>\s*actor_id/);
      expect(body).not.toContain("owner_id=auth.uid()");
    }
  });

  it("writes the real investment_opportunities.workspace_id, never the creator's owner_id, into every downstream table", async () => {
    const migration = await sql();
    expect(migration).not.toMatch(
      /investment_scenario_outcome_revisions values\([^)]*owner_id/,
    );
    expect(migration).not.toMatch(
      /investment_scenario_observations values\([^)]*owner_id/,
    );
    expect(migration).toContain(
      "insert into public.learning_subjects(id,workspace_id,subject_type,source_capability,source_id,source_version,created_by_profile_id,created_at)\n  values(subject_id,o.workspace_id",
    );
  });

  it("takes the advisory lock before reading the idempotency receipt in both outcome and observation RPCs", async () => {
    const migration = await sql();
    const lockThenReceipt =
      /perform pg_advisory_xact_lock\(hashtext\(p_scenario_id\)\);\s*\n\s*select \* into receipt from public\.investment_scenario_learning_receipts/g;
    const matches = migration.match(lockThenReceipt) ?? [];
    expect(matches).toHaveLength(2);
  });

  it("replaces every owner-only RLS read policy with a workspace/delegate-aware check", async () => {
    const migration = await sql();
    expect(migration).toContain(
      'drop policy if exists "Owners inspect scenario outcomes"',
    );
    expect(migration).toContain(
      'drop policy if exists "Owners inspect scenario observations"',
    );
    expect(migration).toContain(
      'drop policy if exists "Owners inspect scenario learning activity"',
    );
    expect(migration).toContain(
      'drop policy if exists "Owners inspect own scenario learning receipts"',
    );
    expect(migration).toContain(
      'drop policy if exists "Operators read own scenario comparison session"',
    );
    const canReadCount = (
      migration.match(/public\.can_read_investment_opportunity\(/g) ?? []
    ).length;
    expect(canReadCount).toBeGreaterThanOrEqual(4);
    expect(migration).toContain(
      "public.active_workspace_role(workspace_id) is not null or public.is_admin()",
    );
  });

  it("keeps the comparison-session read scoped to the requesting profile's own row", async () => {
    const migration = await sql();
    expect(migration).toContain(
      "using(profile_id=auth.uid() and exists(select 1 from public.investment_opportunities o where o.id=opportunity_id and public.can_read_investment_opportunity(o.workspace_id,o.property_id)))",
    );
  });

  it("re-points the scenario-linked foreign keys away from the purged investment_opportunity_analyses table", async () => {
    const migration = await sql();
    for (const table of [
      "investment_scenario_outcome_revisions",
      "investment_scenario_observations",
      "investment_scenario_learning_activity",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} drop constraint if exists ${table}_scenario_id_fkey`,
      );
      expect(migration).toContain(
        `foreign key (scenario_id) references public.investment_scenarios(scenario_id)`,
      );
    }
  });

  it("CRITICAL: coalesces can_read/can_manage_investment_opportunity to false, closing a live cross-tenant bypass", async () => {
    const migration = await sql();
    const readMatch = migration.match(
      /create or replace function public\.can_read_investment_opportunity[\s\S]*?\$\$;/,
    );
    const manageMatch = migration.match(
      /create or replace function public\.can_manage_investment_opportunity[\s\S]*?\$\$;/,
    );
    expect(readMatch).not.toBeNull();
    expect(manageMatch).not.toBeNull();
    expect(readMatch?.[0]).toContain("coalesce(");
    expect(manageMatch?.[0]).toContain("coalesce(");
    expect(readMatch?.[0]).toMatch(/,\s*false\s*\)\s*\$\$;/);
    expect(manageMatch?.[0]).toMatch(/,\s*false\s*\)\s*\$\$;/);
  });
});
