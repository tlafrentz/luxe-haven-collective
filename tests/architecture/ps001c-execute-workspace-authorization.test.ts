import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260823210000_ps001c_execute_workspace_authorization.sql"),
  "utf8",
);
const activation = readFileSync(
  resolve("supabase/migrations/20260823212000_ps001c_unambiguous_plan_activation.sql"),
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

  it("uses an unambiguous payload Action identifier during atomic activation", () => {
    expect(activation).toContain("payload_action_id text");
    expect(activation).toContain("action.id=payload_action_id");
    expect(activation).not.toMatch(/declare[\s\S]*\baction_id text;/i);
  });
});
