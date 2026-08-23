import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260823210000_ps001c_execute_workspace_authorization.sql"),
  "utf8",
);

describe("PS-001C Execute workspace authorization", () => {
  it("authorizes active canonical workspace members without removing legacy compatibility", () => {
    expect(migration).toContain("from public.workspace_memberships membership");
    expect(migration).toContain("membership.profile_id = auth.uid()");
    expect(migration).toContain("membership.status = 'active'");
    expect(migration).toContain("from public.platform_action_workspace_members membership");
  });

  it("does not grant inactive canonical memberships access", () => {
    expect(migration).not.toMatch(/workspace_memberships[\s\S]*status\s*<>\s*'removed'/i);
    expect(migration).toContain("membership.status = 'active'");
  });
});
