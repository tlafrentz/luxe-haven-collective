import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read(
  "supabase/migrations/20260827023000_auth_email_password_setup_grants.sql",
);
const callback = read("src/app/(auth)/auth/callback/route.ts");
const page = read("src/app/(auth)/update-password/page.tsx");
const action = read("src/app/actions/auth.ts");
const grant = read("src/lib/auth/password-setup-grant.ts");
const nextConfig = read("next.config.ts");

describe("AUTH-EMAIL-001 password setup grants", () => {
  it("stores only hashed, short-lived, identity- and flow-bound grants", () => {
    expect(grant).toContain("randomBytes(32)");
    expect(grant).toContain('createHash("sha256")');
    expect(migration).toContain("token_hash text not null unique");
    expect(migration).toContain("invitation_id uuid");
    expect(migration).toContain("auth_user_id uuid not null");
    expect(migration).toContain("normalized_email text not null");
    expect(migration).toContain("p_expires_at>now()+interval '15 minutes'");
    expect(migration).toContain("flow in ('invitation','recovery')");
  });

  it("prevents concurrent grant issuance and consumption", () => {
    expect(migration).toContain("auth_password_setup_grants_invitation_uidx");
    expect(migration).toContain("auth_password_setup_grants_active_actor_uidx");
    expect(migration.match(/for update/g)?.length).toBeGreaterThanOrEqual(4);
    expect(migration).toContain("status='claimed'");
    expect(migration).toContain("status='consumed'");
  });

  it("changes the password, membership, invitation, grant, and audit in one RPC transaction", () => {
    expect(action).toContain("auth.updateUser");
    expect(action).toContain("password_setup_grant_completed");
    expect(migration).toContain(
      "after update of encrypted_password on auth.users",
    );
    expect(migration).toContain(
      "complete_password_setup_from_auth_user_update",
    );
    expect(migration).toContain("insert into public.workspace_memberships");
    expect(migration).toContain("set status='accepted'");
    expect(migration).toContain("'invitation-accepted'");
    expect(migration).not.toContain(
      "update auth.users set encrypted_password=",
    );
  });

  it("does not authorize password setup from an ordinary session", () => {
    expect(page).toContain("PASSWORD_SETUP_GRANT_COOKIE");
    expect(page).toContain("validate_password_setup_grant");
    expect(page).toContain("Password setup unavailable");
    expect(callback).toContain("if (flow && existingUser)");
    expect(callback).toContain(
      "invalidSetupResponse(requestUrl, supabase, false)",
    );
  });

  it("clears only the failed callback attempt session and setup cookies", () => {
    expect(callback).toContain('signOut({ scope: "local" })');
    expect(callback).toContain("clearAttemptSession: boolean");
    expect(callback).toContain("PASSWORD_SETUP_GRANT_COOKIE");
    expect(callback).not.toContain('scope: "global"');
  });

  it("uses an opaque HttpOnly cookie and hardened no-store route", () => {
    expect(grant).toContain("httpOnly: true");
    expect(grant).toContain('sameSite: "lax"');
    expect(grant).toContain('secure: process.env.NODE_ENV === "production"');
    expect(nextConfig).toContain(
      'key: "Cache-Control", value: "private, no-store, max-age=0"',
    );
    expect(nextConfig).toContain(
      'key: "Referrer-Policy", value: "no-referrer"',
    );
  });

  it("requires an explicit scanner-safe interstitial action", () => {
    const emailRoute = read("src/app/auth/email-action/route.ts");
    const confirm = read("src/app/auth/email-action/confirm/page.tsx");
    const emailAction = read("src/app/actions/auth-email-action.ts");
    const inviteTemplate = read("supabase/templates/invite.html");
    const recoveryTemplate = read("supabase/templates/recovery.html");
    expect(emailRoute).not.toContain("/auth/v1/verify");
    expect(confirm).toContain('type="submit"');
    expect(confirm).toContain("prefetch={false}");
    expect(emailAction).toContain("/auth/v1/verify");
    expect(emailAction).toContain("supabase.auth.verifyOtp");
    expect(emailAction).toContain('type: "recovery"');
    expect(inviteTemplate).toContain("/auth/email-action?");
    expect(recoveryTemplate).toContain("/auth/email-action?");
  });

  it("blocks legacy direct acceptance for canonical correlated invitations", () => {
    expect(migration).toContain("PASSWORD_SETUP_GRANT_REQUIRED");
    expect(migration).toContain("if invitation.correlation_id is not null");
  });
});
