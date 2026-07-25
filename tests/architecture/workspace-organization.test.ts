import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260725090000_workspace_organization.sql", import.meta.url),
  "utf8",
);
const repository = readFileSync(
  new URL("../../src/features/workspace/infrastructure/supabase-organization-repository.ts", import.meta.url),
  "utf8",
);
const action = readFileSync(
  new URL("../../src/app/actions/workspace-organization.ts", import.meta.url),
  "utf8",
);
const form = readFileSync(
  new URL("../../src/features/workspace/presentation/organization-form.tsx", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../../src/app/(dashboard)/dashboard/workspace/organization/page.tsx", import.meta.url),
  "utf8",
);

describe("Sprint 4B organization architecture", () => {
  it("extends owners without replacing ownership identity or company data", () => {
    expect(migration).toContain("alter table public.owners");
    expect(migration).toContain("display_name = coalesce(display_name");
    expect(migration).toContain("nullif(trim(company_name)");
    expect(migration).not.toMatch(/drop\s+(table|column).*owners/i);
    expect(migration).not.toMatch(/set\s+profile_id/i);
  });

  it("keeps defaulted regional values distinguishable from confirmation", () => {
    expect(migration).toContain("organization_confirmed_fields");
    expect(migration).toContain("default 'America/Chicago'");
    expect(migration).toContain("default 'USD'");
    expect(migration).toContain("default 'en-US'");
    expect(migration).toContain("default 'US'");
  });

  it("scopes optimistic and idempotent updates to auth profile and workspace", () => {
    expect(migration).toContain("public.can_update_workspace_organization(p_workspace_id)");
    expect(migration).toContain("organization_revision <> p_expected_revision");
    expect(migration).toContain("organization_update_receipts");
    expect(migration).toContain("payload_hash");
    expect(migration).toContain("errcode = '40001'");
    expect(repository).toContain('.eq("id", identity.ownerId)');
    expect(repository).toContain("authenticatedProfileId");
  });

  it("persists bounded activity without contact before-and-after values", () => {
    expect(migration).toContain("organization_activity");
    expect(migration).toContain("changed_fields");
    expect(migration).not.toContain("before_values");
    expect(migration).not.toContain("after_values");
  });

  it("uses a server action, refreshes Workspace health, and preserves form input", () => {
    expect(action).toContain("resolveWorkspaceIdentity");
    expect(action).toContain('revalidatePath("/dashboard/workspace")');
    expect(action).toContain("Your changes were preserved");
    expect(form).toContain("You have unsaved changes.");
    expect(form).toContain("disabled={!dirty || pending}");
    expect(form).toContain("aria-invalid");
  });

  it("renders first-use, incomplete, degraded, permission, and healthy summaries", () => {
    expect(page).toContain("Set up your organization");
    expect(page).toContain("organization.completeness.status");
    expect(page).toContain("operational defaults may be unreliable");
    expect(page).toContain("Organization access is restricted");
    expect(page).toContain("Required organization identity and regional defaults are confirmed.");
  });
});
