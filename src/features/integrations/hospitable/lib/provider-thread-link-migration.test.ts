import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260728090000_idempotent_provider_thread_linking.sql",
  "utf8",
).toLowerCase();

describe("COM-002D database operation", () => {
  it("uses one atomic insert/read operation with workspace-scoped provider identity", () => {
    expect(migration).toContain("link_guest_conversation_provider_thread");
    expect(migration).toContain("on conflict do nothing");
    expect(migration).toContain("workspace_id=p_workspace_id and provider=normalized_provider and thread_id=normalized_thread_id");
    expect(migration).toContain("'outcome',case when inserted then'created'else'reused'end");
  });

  it("classifies immutable identity conflicts", () => {
    expect(migration).toContain("provider_thread_conversation_conflict");
    expect(migration).toContain("provider_thread_workspace_mismatch");
    expect(migration).toContain("provider_thread_identity_invalid");
  });

  it("does not update, delete, or disable the append-only provider-thread history", () => {
    expect(migration).not.toMatch(/update\s+public\.guest_conversation_provider_threads/);
    expect(migration).not.toMatch(/delete\s+from\s+public\.guest_conversation_provider_threads/);
    expect(migration).not.toContain("disable trigger");
    expect(migration).not.toContain("do update");
  });
});
