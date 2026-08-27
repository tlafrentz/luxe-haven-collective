import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read(
  "supabase/migrations/20260826233500_auth_email_admin_workspace_invitations.sql",
);
const action = read("src/app/actions/admin-workspace-invitations.ts");
const dashboard = read("src/app/(dashboard)/layout.tsx");
const adminPage = read("src/app/(admin)/admin/customers/page.tsx");
const adminForm = read(
  "src/components/admin/admin-controlled-owner-invitation-form.tsx",
);

describe("AUTH-EMAIL-001 governed Admin owner invitations", () => {
  it("durably binds normalized identity, workspace, role, actor, expiry, correlation, and idempotency before send", () => {
    for (const evidence of [
      "normalized_email",
      "p_workspace_id",
      "'owner'",
      "actor_id",
      "p_expires_at",
      "p_correlation_id",
      "p_idempotency_key",
      "token_hash",
    ])
      expect(migration).toContain(evidence);
    expect(
      action.indexOf("create_admin_workspace_owner_invitation"),
    ).toBeLessThan(action.indexOf("inviteUserByEmail"));
    expect(action).toContain(
      'confirmation: z.literal("INVITE_CONTROLLED_OWNER")',
    );
    expect(action).toContain("INVITATION_REPLAYED");
  });

  it("atomically rejects wrong identity, expiry, replay, partial binding, and duplicate membership", () => {
    for (const guard of [
      "Invitation token is invalid",
      "Invitation is no longer pending",
      "Invitation has expired",
      "Invitation email does not match authenticated profile",
      "Invitation identity does not match authenticated user",
      "Invitation authentication binding is incomplete",
      "Workspace membership already exists",
    ])
      expect(migration).toContain(guard);
    expect(migration).toContain("for update");
    expect(migration).toContain("consumed_by_profile_id=actor_id");
    expect(migration).toContain("status='accepted'");
  });

  it("revokes delivery/binding failures without creating access", () => {
    expect(action).toContain(
      "revoke_admin_workspace_invitation_delivery_failure",
    );
    expect(action).toContain("admin.auth.admin.deleteUser");
    expect(action).toContain("wasAuthUserCreatedByInvitation");
    expect(action).toContain(
      "authUser.user_metadata?.workspace_invitation_id === invitationId",
    );
    expect(action.indexOf("wasAuthUserCreatedByInvitation(")).toBeLessThan(
      action.lastIndexOf("admin.auth.admin.deleteUser"),
    );
    expect(migration).toContain("status='revoked'");
  });

  it("keeps an authenticated unprovisioned invitee outside the normal workspace shell", () => {
    expect(dashboard).toContain("has_pending_workspace_invitation");
    expect(dashboard).toContain("Finish accepting your invitation");
    expect(dashboard).toContain("!pendingInvitation");
    expect(dashboard.indexOf("if (!access)")).toBeLessThan(
      dashboard.lastIndexOf("getCommerceAccessWorkspace("),
    );
  });

  it("uses the canonical acceptance route and never logs or returns its token", () => {
    expect(action).toContain("/workspace-invitations/accept?workspace=");
    expect(action).not.toMatch(
      /console\.(?:info|log|error)\([^)]*secure\.token/,
    );
    expect(action).not.toMatch(/return\s*\{[^}]*token/);
  });

  it("is reachable only from the authenticated Admin surface with governed inputs and pending protection", () => {
    expect(adminPage).toContain("<AdminControlledOwnerInvitationForm />");
    for (const value of [
      "workspaceId",
      "email",
      "reason",
      "correlationId",
      "idempotencyKey",
      "INVITE_CONTROLLED_OWNER",
    ])
      expect(adminForm).toContain(value);
    expect(adminForm).toContain("window.confirm");
    expect(adminForm).toContain("disabled={pending}");
    expect(adminForm).toContain('aria-live="polite"');
  });
});
