import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("password recovery boundary", () => {
  it("does not render the password form without a valid server grant", () => {
    const page = read("src/app/(auth)/update-password/page.tsx");

    expect(page).toContain("await supabase.auth.getUser()");
    expect(page).toContain("validate_password_setup_grant");
    expect(page).toContain("!flow || validation.error");
    expect(page).toContain('href="/login"');
    expect(page.indexOf("!flow || validation.error")).toBeLessThan(
      page.indexOf("<UpdatePasswordForm flow={flow} />"),
    );
  });

  it("keeps legacy callback exchange failures in a safe state", () => {
    const callback = read("src/app/(auth)/auth/callback/route.ts");

    expect(callback).toContain(
      "await supabase.auth.exchangeCodeForSession(code)",
    );
    expect(callback).toContain('new URL("/update-password?setup=invalid"');
    expect(callback).toContain("issue_recovery_password_setup_grant");
  });

  it("reproduces and prevents the private-browser PKCE recovery failure", () => {
    const emailRoute = read("src/app/auth/email-action/route.ts");
    const continuation = read("src/app/actions/auth-email-action.ts");
    const recoveryBranch = continuation.slice(
      continuation.indexOf('if (action.flow === "recovery")'),
      continuation.indexOf("const provider = new URL"),
    );

    expect(emailRoute).not.toContain("verifyOtp");
    expect(emailRoute).not.toContain("exchangeCodeForSession");
    expect(recoveryBranch.match(/supabase\.auth\.verifyOtp/g)).toHaveLength(1);
    expect(recoveryBranch).toContain("supabase.auth.verifyOtp");
    expect(recoveryBranch).toContain("token_hash: tokenHash");
    expect(recoveryBranch).toContain('type: "recovery"');
    expect(recoveryBranch).toContain("issue_recovery_password_setup_grant");
    expect(recoveryBranch).toContain("PASSWORD_SETUP_GRANT_COOKIE");
    expect(recoveryBranch).toContain('signOut({ scope: "local" })');
    expect(recoveryBranch).toContain('redirect("/update-password?setup=invalid")');
    expect(recoveryBranch).not.toContain("exchangeCodeForSession");
    expect(recoveryBranch).not.toContain("/auth/v1/verify");
  });

  it("claims cross-instance temporary state atomically without storing the raw token", () => {
    const route = read("src/app/auth/email-action/route.ts");
    const continuation = read("src/app/actions/auth-email-action.ts");
    const migration = read(
      "supabase/migrations/20260827043000_auth_email_action_states.sql",
    );
    expect(route).toContain("encryptEmailActionToken(tokenHash)");
    expect(route).toContain("browser_nonce_digest");
    expect(route).not.toContain("verifyOtp");
    expect(continuation).toContain('.eq("status", "pending")');
    expect(continuation).toContain('.update({ status: "claimed"');
    expect(migration).toContain("enable row level security");
    expect(migration).toContain(
      "revoke all on table public.auth_email_action_states from public,anon,authenticated",
    );
    expect(migration).not.toContain("token_hash text");
  });

  it("does not expose raw password-update provider errors", () => {
    const actions = read("src/app/actions/auth.ts");
    const updateBoundary = actions.slice(
      actions.indexOf("export async function updatePasswordAction"),
    );

    expect(updateBoundary).toContain("claim_password_setup_grant");
    expect(updateBoundary).toContain("password_setup_grant_completed");
    expect(updateBoundary).toContain("auth.updateUser");
    expect(updateBoundary).not.toContain("message: error.message");
  });

  it("keeps invitation and recovery flows server-bound and distinct", () => {
    const page = read("src/app/(auth)/update-password/page.tsx");
    const form = read("src/components/auth/password-forms.tsx");
    const actions = read("src/app/actions/auth.ts");
    expect(page).toContain("PASSWORD_SETUP_GRANT_COOKIE");
    expect(page).toContain("<UpdatePasswordForm flow={flow} />");
    expect(form).toContain('type="hidden" name="flow"');
    expect(actions).toContain('z.enum(["invitation", "recovery"])');
    expect(actions).not.toContain("safeInternalDestination(parsed.data.next)");
  });
});
