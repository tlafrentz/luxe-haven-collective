import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260830110000_fs_ux_004_room_packages.sql",
  "utf8",
);

describe("FS-UX-004 forward migration", () => {
  it("follows the frozen FS-UX-003 migration without rewriting predecessors", () => {
    expect(sql).toContain("FS-UX-004");
    expect(sql).toContain("alter table public.furnishing_packages");
    expect(sql).not.toContain("update public.furnishing_packages set workspace_id");
  });

  it("separates scope and freezes legacy ambiguity", () => {
    expect(sql).toContain("governance_scope<>'legacy_ambiguous'");
    expect(sql).toContain("ROOM_PACKAGE_NOT_FOUND_OR_FROZEN");
    expect(sql).not.toMatch(/update public\.furnishing_packages set workspace_id/i);
  });

  it("uses essential priority and a separate fulfillment contract", () => {
    expect(sql).toContain("priority in('essential','recommended','optional')");
    expect(sql).toContain("fulfillment_required boolean");
    expect(sql).not.toContain("priority in('required'");
  });

  it("makes review, validation, and approval snapshots authoritative", () => {
    for (const token of [
      "fsux4_package_validation_runs",
      "fsux4_package_review_events",
      "fsux4_package_approval_snapshots",
      "ROOM_PACKAGE_VALIDATION_STALE",
      "ROOM_PACKAGE_APPROVAL_SNAPSHOT_IMMUTABLE",
    ])
      expect(sql).toContain(token);
    expect(sql).toContain("jsonb_array_length(snapshot->'items')=0");
  });

  it("guards concurrency and idempotency without external effects", () => {
    expect(sql).toContain("optimistic_version");
    expect(sql).toContain("pg_advisory_xact_lock");
    expect(sql).toContain("idempotency_key text not null unique");
    expect(sql).toContain("'status','replayed'");
    expect(sql).toContain("'externalEffects',false");
    for (const table of ["commerce_payments", "notifications", "furnishing_procurement_orders", "furnishing_installation_tasks"])
      expect(sql).not.toContain(`insert into public.${table}`);
  });

  it("keeps package products governed and template adoption explicit", () => {
    expect(sql).toContain("ROOM_PACKAGE_PRODUCT_INELIGIBLE_OR_ADOPTION_REQUIRED");
    expect(sql).toContain("fsux4_package_adoptions");
    expect(sql).not.toContain("insert into public.furnishing_product_adoptions");
  });
});
