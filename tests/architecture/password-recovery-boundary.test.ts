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

  it("surfaces callback exchange failures as a safe recovery state", () => {
    const callback = read("src/app/(auth)/auth/callback/route.ts");

    expect(callback).toContain(
      "await supabase.auth.exchangeCodeForSession(code)",
    );
    expect(callback).toContain('new URL("/update-password?setup=invalid"');
    expect(callback).toContain("issue_recovery_password_setup_grant");
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
