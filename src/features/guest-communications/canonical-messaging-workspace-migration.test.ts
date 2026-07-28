import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const migration = fs.readFileSync(
  path.resolve(
    "supabase/migrations/20260727040000_canonical_messaging_workspace.sql",
  ),
  "utf8",
);

describe("COM-002C canonical messaging workspace migration", () => {
  it("repairs canonical messaging workspace without mutating immutable communication history", () => {
    expect(migration).toContain("update public.guest_conversations");
    expect(migration).toContain("set workspace_id = property.owner_id");

    expect(migration).toContain("update public.guest_message_hydrations");
    expect(migration).toContain(
      "set workspace_id = conversation.workspace_id",
    );

    expect(migration).toContain(
      "update public.messaging_provider_review_queue",
    );
    expect(migration).toContain(
      "update public.messaging_provider_activity",
    );

    expect(migration).not.toContain(
      "update public.guest_conversation_provider_threads",
    );
    expect(migration).not.toContain(
      "update public.guest_conversation_activity",
    );

    expect(migration).toContain("references public.owners(id)");
  });
});
