import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260812134000_fix_oc001_entitlement_activation.sql",
  "utf8",
);

describe("OC-001 entitlement activation migration", () => {
  it("qualifies the offer capability lookup and preserves service-role execution", () => {
    expect(migration).toContain("resolved_offer_id uuid");
    expect(migration).toContain("capability.offer_id = resolved_offer_id");
    expect(migration).not.toMatch(/where\s+offer_id\s*=\s*offer_id/i);
    expect(migration).toContain("to service_role");
    expect(migration).toContain("from public, anon, authenticated");
  });
});
