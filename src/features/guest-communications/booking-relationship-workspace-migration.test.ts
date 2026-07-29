import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260728130000_fix_booking_relationship_workspace_identity.sql",
  "utf8",
);

describe("GC-001 booking relationship workspace identity", () => {
  it("derives workspace identity from the canonical property owner", () => {
    expect(migration).toContain("select property.owner_id");
    expect(migration).toContain("from public.properties property");
    expect(migration).toContain("property.id = new.property_id");
  });

  it("does not derive workspace identity from the guest profile-era owner field", () => {
    expect(migration).not.toContain(
      "select owner_id into workspace from public.guests",
    );
  });

  it("preserves booking relationship event semantics", () => {
    for (const event of [
      "reservation-created",
      "reservation-cancelled",
      "checkout",
      "check-in",
      "reservation-updated",
    ]) {
      expect(migration).toContain(event);
    }
    expect(migration).toContain("'booking'");
    expect(migration).toContain("on conflict do nothing");
  });
});
