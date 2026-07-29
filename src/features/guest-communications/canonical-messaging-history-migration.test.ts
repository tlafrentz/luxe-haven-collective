import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260728140000_canonicalize_messaging_history_workspace.sql",
  "utf8",
);

describe("GC-009 canonical messaging history", () => {
  it("fails before merging a provider thread across conversations", () => {
    expect(migration).toContain(
      "provider thread identity maps to conflicting canonical conversations",
    );
    expect(migration).toContain(
      "canonical.conversation_id is distinct from legacy.conversation_id",
    );
  });

  it("removes only exact legacy/canonical provider-thread duplicates", () => {
    expect(migration).toContain(
      "delete from public.guest_conversation_provider_threads legacy",
    );
    expect(migration).toContain(
      "canonical.conversation_id = legacy.conversation_id",
    );
    expect(migration).toContain(
      "canonical.provider = legacy.provider",
    );
    expect(migration).toContain(
      "canonical.thread_id = legacy.thread_id",
    );
  });

  it.each([
    "guest_conversation_provider_threads",
    "guest_conversation_activity",
  ])("maps and constrains %s to owners.id", (table) => {
    expect(migration).toContain(`update public.${table}`);
    expect(migration).toMatch(
      new RegExp(
        `alter table public\\.${table}[\\s\\S]*?foreign key \\(workspace_id\\)[\\s\\S]*?references public\\.owners\\(id\\)`,
      ),
    );
  });

  it("restores both append-only guards", () => {
    expect(migration).toContain(
      "enable trigger guest_provider_threads_append_only",
    );
    expect(migration).toContain(
      "enable trigger guest_conversation_activity_append_only",
    );
  });
});
