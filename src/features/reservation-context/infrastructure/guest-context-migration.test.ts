import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260724130000_guest_reservation_context.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("guest reservation context migration", () => {
  it("is forward-only, deterministic, and safe for existing bookings", () => {
    expect(migration).toContain("add column if not exists primary_guest_id");
    expect(migration).toContain("md5('booking:' || b.id::text)::uuid");
    expect(migration).toContain("on conflict (id) do nothing");
    expect(migration).not.toMatch(/drop table|truncate/i);
  });

  it("enforces owner RLS for guests and provider references", () => {
    expect(migration).toContain("alter table public.guests enable row level security");
    expect(migration).toContain("using (owner_id = auth.uid())");
    expect(migration).toContain(
      "alter table public.provider_guest_references enable row level security",
    );
  });

  it("deduplicates by workspace and provider guest identity", () => {
    expect(migration).toContain(
      "unique (owner_id, provider, external_guest_id)",
    );
    expect(migration).toContain(
      "on conflict (owner_id, provider, external_guest_id) do update",
    );
  });
});
