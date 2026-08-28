import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read(
  "supabase/migrations/20260828020000_beta_email_invitation_observability.sql",
);
const action = read("src/app/actions/admin-workspace-invitations.ts");

describe("BETA-EMAIL-001 invitation observability correction", () => {
  it("persists the canonical invitation request before external delivery", () => {
    expect(
      action.indexOf("create_or_replay_invitation_auth_email_request"),
    ).toBeLessThan(action.indexOf("inviteUserByEmail"));
    for (const field of [
      "invitation_id",
      "workspace_id",
      "intended_role",
      "idempotency_key",
      "recipient_digest",
      "legacy_reconciled",
    ])
      expect(migration).toContain(field);
  });

  it("makes replay and delivery failure terminal without another send", () => {
    expect(migration).toContain(
      "AUTH_EMAIL_INVITATION_REQUEST_REPLAY_MISMATCH",
    );
    expect(action).toContain("INVITATION_REPLAYED");
    expect(action).toContain('p_status: "failed"');
    expect(action).toContain(
      "revoke_admin_workspace_invitation_delivery_failure",
    );
  });

  it("reconciles only exact legacy sent and delivered receipts", () => {
    expect(migration).toContain(
      "reconcile_legacy_invitation_auth_email_request",
    );
    expect(migration).toContain("s.provider_message_id<>d.provider_message_id");
    expect(migration).toContain("AUTH_EMAIL_LEGACY_RECEIPTS_AMBIGUOUS");
    expect(migration).toMatch(/legacy_reconciled\)\s*values[\s\S]*true\)/);
  });

  it("keeps all new functions service-only with fixed search paths", () => {
    expect(migration.match(/security definer set search_path=/g)).toHaveLength(
      3,
    );
    expect(migration.match(/to service_role/g)).toHaveLength(3);
    expect(migration).toContain("from public,anon,authenticated");
  });
});
