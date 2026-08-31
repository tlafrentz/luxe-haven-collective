import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20260830140000_fs_ux_007_delivery_installation_tracking.sql", "utf8");

describe("FS-UX-007 forward migration", () => {
  it("extends canonical installation, order, shipment, and receipt identities", () => {
    expect(sql).toContain("alter table public.furnishing_installation_projects");
    expect(sql).toContain("alter table public.furnishing_procurement_orders");
    expect(sql).toContain("alter table public.furnishing_shipments");
    expect(sql).toContain("alter table public.furnishing_procurement_receipts");
    expect(sql).not.toContain("create table public.delivery_projects");
  });
  it("creates no automatic order or shipment from readiness", () => {
    const create = sql.slice(sql.indexOf("create function public.fsux7_create_project"), sql.indexOf("create function public.fsux7_record_order"));
    expect(create).not.toContain("insert into public.furnishing_procurement_orders");
    expect(create).not.toContain("insert into public.furnishing_shipments");
    expect(create).toContain("'orders_created',0");
  });
  it("distinguishes evidence classes and carrier delivery from receipt", () => {
    expect(sql).toContain("carrier_reported_delivered");
    expect(sql).toContain("reported_unverified");
    expect(sql).toContain("provider_confirmed");
    expect(sql).toContain("controlled_test");
  });
  it("enforces receipt and installation quantity ceilings", () => {
    expect(sql).toContain("RECEIPT_QUANTITY_EXCEEDED");
    expect(sql).toContain("INSTALLATION_QUANTITY_EXCEEDED");
    expect(sql).toContain("for update");
  });
  it("preserves immutable completion and correction evidence", () => {
    expect(sql).toContain("fsux7_completion_snapshots");
    expect(sql).toContain("fsux7_evidence_corrections");
    expect(sql).toContain("INSTALLATION_EVIDENCE_IMMUTABLE");
  });
  it("extends service-only cleanup and rejects real external evidence", () => {
    expect(sql).toContain("cleanup_fs008g_synthetic_project_pre_fsux7");
    expect(sql).toContain("CLEANUP_EXTERNAL_EVIDENCE_PROHIBITED");
    expect(sql).toContain("retainedCompletionSnapshots");
    expect(sql).toContain("to service_role");
  });
  it("uses RLS, fixed search paths, and denied direct writes", () => {
    expect(sql.match(/enable row level security/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sql.match(/set search_path=public/g)?.length).toBeGreaterThanOrEqual(8);
    expect(sql).toContain("revoke all on public.fsux7_planned_lines");
  });
});
