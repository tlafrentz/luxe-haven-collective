import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260810050000_au001_production_runtime_identity.sql",
  "utf8",
);
const rpcMigration = readFileSync(
  "supabase/migrations/20260810051000_au001_execute_service_rpc_scope.sql",
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

  it("exposes only atomic empty-draft creation and own-draft reads", () => {
    expect(rpcMigration).toContain("Automation Execute identity reads own drafts");
    expect(rpcMigration).toContain("p_expected_version is not null");
    expect(rpcMigration).toContain("jsonb_array_length(coalesce(p_draft_actions,'[]'::jsonb))<>0");
    expect(rpcMigration).toContain("may create an empty draft plan only");
    expect(rpcMigration).toContain("grant execute on function public.save_execute_action_plan");
  });
});
