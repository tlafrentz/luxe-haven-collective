import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260728120000_finish_guest_communications_workspace_identity.sql",
  "utf8",
);

const canonicalTables = [
  "guest_relationship_events",
  "guest_communication_templates",
  "guest_communication_recommendations",
  "guest_communication_guidance_activity",
] as const;

describe("GC-001 / GC-002 canonical workspace identity", () => {
  it.each(canonicalTables)(
    "repairs and constrains %s to owners.id",
    (table) => {
      expect(migration).toContain(`update public.${table}`);
      expect(migration).toContain(
        `${table} contains a workspace_id that is not an owners.id`,
      );
      expect(migration).toMatch(
        new RegExp(
          `alter table public\\.${table}[\\s\\S]*?foreign key \\(workspace_id\\)[\\s\\S]*?references public\\.owners\\(id\\)`,
        ),
      );
    },
  );

  it("maps legacy owner profile IDs without rewriting canonical owner IDs", () => {
    expect(migration).toContain("item.workspace_id = owner.profile_id");
    expect(migration).toContain("canonical.id = item.workspace_id");
  });

  it("preserves global templates and author profile identities", () => {
    expect(migration).toContain("where item.workspace_id is not null");
    expect(migration).not.toMatch(
      /published_by|actor_profile_id|acted_by|sender_profile_id|author_profile_id/,
    );
  });

  it("authorizes template reads through canonical workspace membership", () => {
    expect(migration).toContain(
      "public.active_workspace_role(workspace_id) is not null",
    );
    expect(migration).not.toContain("workspace_id = auth.uid()");
  });
});
