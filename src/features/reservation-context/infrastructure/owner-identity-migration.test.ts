import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260724150000_fix_owner_identity_resolution.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("canonical owner identity corrective migration", () => {
  it("defines one owner-to-profile resolution path", () => {
    expect(migration).toContain(
      "create or replace function public.owner_profile_id",
    );
    expect(migration).toContain(
      "create or replace function public.property_owner_profile_id",
    );
    expect(migration).toContain("public.owner_profile_id(p.owner_id)");
  });

  it("uses profile identity for guests, references, quality, and RLS", () => {
    expect(migration).toContain("join public.owners o on o.id = p.owner_id");
    expect(migration).toContain("into booking_profile_id");
    expect(migration).toContain("booking_profile_id,");
    expect(migration).toContain(
      "using (public.owner_profile_id(owner_id) = auth.uid())",
    );
    expect(migration).toContain(
      "on conflict (owner_id, provider, external_guest_id) do update",
    );
    expect(migration).toContain(
      "using (public.property_owner_profile_id(property_id) = auth.uid())",
    );
    expect(migration).toContain(
      'drop policy if exists "Owners can read property bookings" on public.bookings',
    );
  });

  it("replaces the booking trigger function before updating bookings", () => {
    const triggerReplacement = migration.indexOf(
      "create or replace function public.queue_booking_quality_re_evaluation",
    );
    const bookingUpdate = migration.indexOf("update public.bookings b");

    expect(triggerReplacement).toBeGreaterThan(-1);
    expect(bookingUpdate).toBeGreaterThan(triggerReplacement);
  });

  it("preserves reservation and guest records and verifies the backfill", () => {
    expect(migration).not.toMatch(/\b(truncate|drop table)\b/i);
    expect(migration).not.toMatch(/update public\.bookings\s+b\s+set\s+id/i);
    expect(migration).toContain("and b.primary_guest_id is null");
    expect(migration).toContain(
      "raise exception 'Owner identity repair left orphan bookings'",
    );
    expect(migration).toContain(
      "raise exception 'Owner identity repair left queue rows with invalid profile owners'",
    );
  });

  it("repairs queue collisions and requeues every owned booking", () => {
    expect(migration).toContain(
      "delete from public.operational_quality_re_evaluation_queue",
    );
    expect(migration).toContain(
      "update public.operational_quality_re_evaluation_queue",
    );
    expect(migration).toContain("'owner-identity-repaired'");
  });
});
