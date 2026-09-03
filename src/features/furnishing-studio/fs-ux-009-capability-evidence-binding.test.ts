import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260902013000_fs_ux_009_capability_evidence_binding.sql",
  "utf8",
);

describe("FS-UX-009 capability verification evidence binding", () => {
  it("binds the immutable v2 audit event in the same transaction", () => {
    expect(migration).toContain("after insert on public.furnishing_activation_audit_events");
    expect(migration).toContain("set verification_event_id = new.id");
    expect(migration).toContain("capability.verification_state = verification_result");
    expect(migration).toContain("capability.verified_by = new.actor_id");
    expect(migration).toContain("FURNISHING_RELEASE_VERIFICATION_EVIDENCE_UNBOUND");
  });

  it("does not grant a callable verification or mutation boundary", () => {
    expect(migration).toContain(
      "from public, anon, authenticated, service_role",
    );
    expect(migration).not.toMatch(/grant\s+(execute|insert|update|delete)/i);
  });

  it("backfills only matching authoritative v2 evidence", () => {
    expect(migration).toContain("distinct on (event.release_id, event.after_state ->> 'capability')");
    expect(migration).toContain("capability.verification_event_id is null");
    expect(migration).toContain("capability.verified_by = evidence.actor_id");
  });
});
