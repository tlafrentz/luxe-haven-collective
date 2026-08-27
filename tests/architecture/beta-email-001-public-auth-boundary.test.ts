import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/20260828010000_beta_email_auth_operations.sql");
const guard = read("src/lib/auth/public-auth.ts");
const auth = read("src/app/actions/auth.ts");
const commerce = ["commerce-account","guidebook-commerce","investment-commerce","furnishing-commerce"].map(name => read(`src/app/actions/${name}.ts`));
const forms = ["src/components/auth/login-form.tsx","src/components/auth/register-form.tsx","src/components/auth/password-forms.tsx","src/features/commerce-onboarding/create-account-form.tsx","src/features/commerce-onboarding/guidebook-create-account-form.tsx","src/features/commerce-onboarding/investment-create-account-form.tsx","src/features/commerce-onboarding/furnishing-create-account-form.tsx"].map(read);

describe("BETA-EMAIL-001 public Auth boundary", () => {
  it("defaults closed and permits only governed modes through an Admin RPC", () => {
    expect(migration).toContain("mode text not null default 'closed'");
    expect(migration).toContain("AUTH_PUBLIC_CONTROL_ADMIN_REQUIRED");
    expect(migration).toContain("AUTH_PUBLIC_CONTROL_VERSION_CONFLICT");
    expect(migration).toContain("AUTH_PUBLIC_CONTROL_REPLAY_MISMATCH");
    expect(migration).toContain("auth_public_control_audit");
  });

  it("requires the shared CAPTCHA decision on every public credential or email path", () => {
    expect(auth).toContain('authorizePublicAuth("login"');
    expect(auth).toContain('authorizePublicAuth("signup"');
    expect(auth).toContain('authorizePublicAuth("recovery"');
    expect(auth).toContain("captchaToken: decision.captchaToken");
    for (const action of commerce) {
      expect(action).toContain('authorizePublicAuth("signup"');
      expect(action).toContain("captchaToken: decision.captchaToken");
      expect(action).not.toMatch(/message:\s*(?:error|signUpError)\.message/);
    }
    for (const form of forms) {
      expect(form).toContain("TurnstileChallenge");
      expect(form).toContain("PublicAuthSubmitButton");
    }
  });

  it("fails closed without configuration, suppresses without enumeration, and retains server limits", () => {
    expect(guard).toContain("CAPTCHA_UNAVAILABLE");
    expect(guard).toContain("RECIPIENT_SUPPRESSED");
    expect(auth).toContain("neutralRecoveryMessage");
    const config = read("supabase/config.toml");
    expect(config).toContain('provider = "turnstile"');
    expect(config).toContain('max_frequency = "60s"');
    expect(config).toContain("email_sent = 30");
    expect(config).toContain("enable_anonymous_sign_ins = false");
  });
});
