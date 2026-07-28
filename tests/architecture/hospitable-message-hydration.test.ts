import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migration = fs.readFileSync(
  path.join(process.cwd(), "supabase/migrations/20260727030000_hospitable_historical_message_hydration.sql"),
  "utf8",
);
const sync = fs.readFileSync(
  path.join(process.cwd(), "src/features/integrations/hospitable/lib/sync-messages.ts"),
  "utf8",
);
const webhook = fs.readFileSync(
  path.join(process.cwd(), "src/app/api/webhooks/hospitable/messages/route.ts"),
  "utf8",
);

describe("GM-001B canonical historical message hydration architecture", () => {
  it("tracks resumable completion for one provider reservation", () => {
    expect(migration).toContain("create table public.guest_message_hydrations");
    expect(migration).toContain("unique(workspace_id,provider,provider_reservation_id)");
    expect(migration).toContain("'not_started','in_progress','completed','partial','failed'");
    expect(migration).toContain("next_page integer");
  });

  it("rejects ambiguous booking-to-conversation lineage at the database boundary", () => {
    expect(migration).toContain("GM-001B cannot enforce unambiguous booking conversation lineage");
    expect(migration).toContain("guest_reservation_one_conversation_per_booking");
    expect(migration).toContain("if resolved_count<>1");
  });

  it("deduplicates history and webhooks through one provider identity", () => {
    expect(migration).toContain("guest_message_provider_identity_key");
    expect(migration).toContain("provider_native_message_id=p_provider_message_id");
    expect(sync).toContain("hydrateHospitableReservationMessageHistory");
    expect(webhook).toContain('admin.rpc("ingest_guest_provider_message"');
  });

  it("persists provider chronology, provenance, and attachment metadata", () => {
    for (const field of [
      "provider_reservation_id",
      "provider_conversation_id",
      "provider_native_message_id",
      "provider_occurred_at",
      "ingested_at",
      "content_type",
      "provider_metadata",
      "provenance",
      "provider_attachment_id",
    ]) expect(migration).toContain(field);
  });

  it("creates one completion activity instead of one activity per imported message", () => {
    const ingest = functionBody("ingest_guest_provider_message");
    const complete = functionBody("complete_guest_message_hydration");
    expect(complete).toContain("'history-imported'");
    expect(complete).toContain("'activity-'||hydration.id");
    expect(ingest).toContain("if not p_backfill then");
  });

  it("aligns conversation and message reads with property-scoped RLS", () => {
    expect(migration).toContain('drop policy if exists "Owners read conversations"');
    expect(migration).toContain('drop policy if exists "Owners read conversation messages"');
    expect(migration.match(/can_access_workspace_property/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

function functionBody(name: string) {
  const start = migration.indexOf(`create or replace function public.${name}`);
  const end = migration.indexOf("end $$;", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return migration.slice(start, end);
}
