import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20260827010000_auth_email_resume_bound_invitation.sql");
const action = read("src/app/actions/workspace-invitation-recovery.ts");
const dashboard = read("src/app/(dashboard)/layout.tsx");

describe("AUTH-EMAIL-002 bound invitation recovery", () => {
  it("limits discovery and rotation to the authenticated bound identity", () => {
    expect(migration).toContain("invitation.auth_invitation_user_id=auth.uid()");
    expect(migration).toContain("auth_invitation_user_id=actor_id");
    expect(migration).toContain("email=actor_email");
    expect(migration).toContain("status='pending'");
    expect(migration).toContain("expires_at>now()");
    expect(migration).toContain("BOUND_INVITATION_RESUME_FORBIDDEN");
    expect(migration).toContain("BOUND_INVITATION_RESUME_NOT_FOUND");
  });

  it("rotates the token atomically without granting access", () => {
    expect(migration).toContain("for update");
    expect(migration).toContain("token_hash=p_token_hash");
    expect(migration).toContain("'bound-invitation-resumed'");
    expect(migration).toContain("workspace_access_command_receipts");
    expect(migration).toContain("BOUND_INVITATION_RESUME_REPLAY_MISMATCH");
    expect(migration).not.toContain("insert into public.workspace_memberships");
  });

  it("uses ordinary authentication and reveals the fresh token only to the existing acceptance route", () => {
    expect(action).toContain("await requireUser()");
    expect(action).toContain("createClient()");
    expect(action).not.toContain("createAdminClient");
    expect(action).toContain("rotate_bound_workspace_invitation_token");
    expect(action).toContain("/workspace-invitations/accept?");
    expect(action).not.toMatch(/console\.(?:info|log|error)/);
  });

  it("offers exactly one recovery control from the pending-invitation guard", () => {
    expect(dashboard).toContain("resumeBoundWorkspaceInvitationAction");
    expect(dashboard).toContain("Resume invitation");
    expect(dashboard).toContain("{pendingInvitation ? (");
  });
});
