import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260728150000_attachment_backfill_existing_messages.sql",
  "utf8",
);

describe("COM-002I attachment backfill for existing messages", () => {
  it("resolves an existing parent without returning before attachment ingestion", () => {
    expect(migration).toContain("select id\n  into message_id");
    expect(migration).not.toMatch(
      /if exists\([\s\S]*?guest_communication_messages[\s\S]*?then return false/,
    );
    expect(migration.indexOf("for attachment,attachment_index in")).toBeGreaterThan(
      migration.indexOf("if message_id is null then"),
    );
    expect(migration).toContain("return message_inserted");
  });

  it("inserts a parent only when absent and handles a concurrent insert", () => {
    expect(migration).toContain("message_inserted boolean := false");
    expect(migration).toContain(
      "on conflict(provider,provider_native_message_id)",
    );
    expect(migration).toMatch(
      /if found then[\s\S]*?message_inserted:=true;[\s\S]*?else[\s\S]*?select id[\s\S]*?into message_id/,
    );
  });

  it("keeps attachment replay idempotent with a deterministic fallback", () => {
    expect(migration).toContain(
      "p_provider_message_id||':attachment:'||attachment_index",
    );
    expect(migration).toContain(
      "on conflict(provider,provider_attachment_id)",
    );
    expect(migration).toContain("do nothing");
  });

  it("accepts live {type, url} attachment payloads", () => {
    expect(migration).toContain("nullif(attachment->>'url','')");
    expect(migration).toContain(
      "when coalesce(attachment->>'type','')in('image','pdf','link')",
    );
  });

  it("does not replay new-message-only conversation side effects", () => {
    expect(migration).toMatch(
      /if message_inserted then[\s\S]*?guest_message_delivery_events[\s\S]*?update public\.guest_conversations/,
    );
  });
});
