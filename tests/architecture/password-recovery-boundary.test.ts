import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("password recovery boundary", () => {
  it("does not render the password form without an authenticated session", () => {
    const page = read("src/app/(auth)/update-password/page.tsx");

    expect(page).toContain("await supabase.auth.getUser()");
    expect(page).toContain("if (!user)");
    expect(page).toContain('href="/forgot-password"');
    expect(page.indexOf("if (!user)")).toBeLessThan(
      page.indexOf("<UpdatePasswordForm />"),
    );
  });

  it("surfaces callback exchange failures as a safe recovery state", () => {
    const callback = read("src/app/(auth)/auth/callback/route.ts");

    expect(callback).toContain("const { error } = await supabase.auth.exchangeCodeForSession(code)");
    expect(callback).toContain('new URL("/update-password"');
    expect(callback).toContain('recoveryUrl.searchParams.set("recovery", "invalid")');
  });

  it("does not expose raw password-update provider errors", () => {
    const actions = read("src/app/actions/auth.ts");
    const updateBoundary = actions.slice(actions.indexOf("export async function updatePasswordAction"));

    expect(updateBoundary).toContain('error.code === "session_not_found"');
    expect(updateBoundary).not.toContain("message: error.message");
  });
});
