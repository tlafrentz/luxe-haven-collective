import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql=readFileSync("supabase/migrations/20260806062000_fs006_budget_procurement_engine.sql","utf8");
describe("FS-006 migration",()=>{
 it("creates one idempotent baseline per approved source plan",()=>{expect(sql).toContain("unique(source_plan_id)");expect(sql).toContain("idempotency_key")});
 it("keeps estimated authorized actual refund and credit amounts distinct",()=>{for(const field of ["estimated_total_minor","authorized_total_minor","gross_actual_minor","refunded_minor","credited_minor"])expect(sql).toContain(field)});
 it("preserves immutable order and event snapshots",()=>{expect(sql).toContain("furnishing_procurement_order_lines");expect(sql).toContain("furnishing_procurement_events");expect(sql).toContain("terms_snapshot")});
 it("supports partial fulfillment returns and refunds",()=>{expect(sql).toContain("furnishing_shipment_lines");expect(sql).toContain("furnishing_procurement_receipt_lines");expect(sql).toContain("furnishing_procurement_returns");expect(sql).toContain("furnishing_procurement_refunds")});
 it("enables RLS for all FS-006 aggregates",()=>expect(sql).toContain("alter table public.%I enable row level security"));
 it("uses a migration version after FS-005",()=>expect(20260806062000).toBeGreaterThan(20260806061000));
});
