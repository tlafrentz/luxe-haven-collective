import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";
const sql=readFileSync("supabase/migrations/20260817223000_controlled_extraction_admin_projection.sql","utf8").toLowerCase();
describe("controlled extraction Admin projection RLS",()=>{it("permits authenticated Admin reads at each canonical boundary",()=>{for(const table of["customer_accounts","commercial_entitlements","property_entitlement_allocations"])expect(sql).toContain(`on public.${table} for select to authenticated using(public.is_admin())`)})});
