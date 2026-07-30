import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(resolve(process.cwd(), "supabase/migrations/20260730010000_wi001_property_snapshots.sql"), "utf8");

describe("WI-001 property snapshot migration", () => {
  it("makes snapshots immutable and inaccessible to browser roles", () => {
    expect(sql).toContain("create table public.property_snapshots");
    expect(sql).toContain("unique(subject_property_id, version)");
    expect(sql).toContain("before update or delete");
    expect(sql).toContain("revoke all on public.property_snapshots from anon, authenticated");
    expect(sql).toContain("grant all on public.property_snapshots to service_role");
  });
});
