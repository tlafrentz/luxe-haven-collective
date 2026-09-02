import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260902010000_fs_ux_009_customer_approval_snapshot.sql",
  "utf8",
);
const action = readFileSync(
  "src/app/actions/furnishing-project-workspace.ts",
  "utf8",
);
const workspace = readFileSync(
  "src/components/furnishing/project-workspace-v1.tsx",
  "utf8",
);

describe("FS-UX-009 customer approval snapshot correction", () => {
  it("keeps approval, immutable snapshot, aggregate updates, command, and activity in one RPC", () => {
    expect(migration).toContain(
      "create or replace function public.transition_furnishing_owner_plan",
    );
    expect(migration).toContain("insert into public.fsux5_approval_snapshots");
    expect(migration).toContain("update public.furnishing_plans set status='approved'");
    expect(migration).toContain("update public.furnishing_projects set plan_status='approved'");
    expect(migration).toContain("insert into public.furnishing_owner_plan_commands");
    expect(migration).toContain("insert into public.fsux5_activity");
  });

  it("captures authoritative product-version and offer evidence without external effects", () => {
    expect(migration).toContain("'product_version',to_jsonb(product_version)");
    expect(migration).toContain("'offer',to_jsonb(offer)");
    expect(migration).toContain("'externalEffects',false");
    expect(migration).not.toMatch(
      /insert into public\.(furnishing_procurement_orders|commerce_payments|notification_deliveries)/,
    );
  });

  it("supports replay, conflict, stale-state, and forced atomic-failure proofs", () => {
    expect(migration).toContain("OWNER_PLAN_REPLAY_CONFLICT");
    expect(migration).toContain("OWNER_PLAN_STALE");
    expect(migration).toContain("fsux9.force_approval_snapshot_failure");
    expect(migration).toContain("fsux9.force_approval_audit_failure");
    expect(migration).toContain("OWNER_PLAN_APPROVED_WITHOUT_SNAPSHOT");
  });

  it("lets the customer UI submit approval through the authenticated RPC", () => {
    expect(action).not.toContain('requireRole(["admin"])');
    expect(action).toContain('authenticated.rpc("transition_furnishing_owner_plan"');
    expect(workspace).toContain('plan.status === "awaiting_approval" ?');
  });
});
