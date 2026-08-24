import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const action = readFileSync("src/app/actions/workspace.ts", "utf8");
const control = readFileSync("src/features/workspace/presentation/initialize-workspace-form.tsx", "utf8");
const layout = readFileSync("src/app/(dashboard)/layout.tsx", "utf8");
const migration = readFileSync("supabase/migrations/20260806030000_initialize_workspace_owner_membership.sql", "utf8");

describe("initial workspace onboarding boundary", () => {
  it("renders an explicit submit control wired to the canonical server action", () => {
    expect(control).toContain('useActionState(initializeWorkspaceAction, {})');
    expect(control).toContain('type="submit"');
    expect(control).toContain('disabled={pending}');
    expect(control).toContain('role="status"');
    expect(layout).toContain('profile?.role === "owner" || profile?.role === "admin"');
    expect(layout).toContain("<InitializeWorkspaceForm />");
  });

  it("preserves authenticated eligibility checks and a recoverable failure state", () => {
    expect(action).toContain("requireUser()");
    expect(action).toContain("initializeWorkspaceOwner(new SupabaseWorkspaceRepository()");
    expect(action).toContain("ok: false");
    expect(action).not.toContain("redirect(");
  });

  it("creates one owner and owner membership atomically and idempotently", () => {
    expect(migration).toContain("authenticated_profile_id uuid := auth.uid()");
    expect(migration).toContain("profile.role in ('owner', 'admin')");
    expect(migration).toContain("insert into public.owners");
    expect(migration).toContain("insert into public.workspace_memberships");
    expect(migration.match(/on conflict/g)).toHaveLength(2);
    expect(migration).toContain("'owner', 'active', 'all'");
  });
});
