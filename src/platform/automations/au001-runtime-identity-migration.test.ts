import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260810050000_au001_production_runtime_identity.sql",
  "utf8",
);

describe("AU-001 production runtime identity migration", () => {
  it("binds grants to one Execute command and an explicit property scope", () => {
    expect(migration).toContain("check(command_type='createDraftPlan')");
    expect(migration).toContain("check(cardinality(property_ids)>0)");
    expect(migration).toContain("grant_row.profile_id=auth.uid()");
  });

  it("denies plan activation, plan mutation, and canonical Action creation", () => {
    expect(migration).toContain("new.status<>'draft'");
    expect(migration).toContain("tg_op<>'INSERT'");
    expect(migration).toContain("automation_execute_no_actions");
    expect(migration).toContain("may not create assigned Actions");
  });

  it("does not expose grant mutation to authenticated or anonymous roles", () => {
    expect(migration).toContain("grant all on public.automation_execute_service_grants to service_role");
    expect(migration).not.toMatch(/grant (insert|update|delete|all).*automation_execute_service_grants to authenticated/i);
  });
});
