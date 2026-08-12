import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";

const migration=readFileSync("supabase/migrations/20260811050000_ca001a_offer_catalog_entitlements.sql","utf8");
describe("CA-001A persistence security",()=>{
 it("enables RLS on every exposed commercial table",()=>{for(const table of ["commercial_offer_versions","commercial_offer_capabilities","commercial_offer_limits","commercial_offer_onboarding_requirements","customer_accounts","customer_account_memberships","commercial_entitlements","commercial_entitlement_status_history","commercial_activation_attempts"])expect(migration).toContain(`alter table public.${table} enable row level security`)});
 it("denies anonymous and browser mutation access",()=>{expect(migration).toMatch(/revoke all on[\s\S]+from anon/);expect(migration).toMatch(/revoke insert,update,delete on[\s\S]+from authenticated/)});
 it("preserves active offer versions and entitlement origins",()=>{expect(migration).toContain("Active offer versions are immutable");expect(migration).toContain("Entitlement origin is immutable");expect(migration).toContain("unique(code,version)")});
 it("classifies guidebook-only participation without changing identity",()=>{expect(migration).toContain("guidebook_only");expect(migration).toContain("does not alter canonical identity or grant access")});
 it("contains no billing-provider columns",()=>{const canonical=migration.slice(0,migration.indexOf("create table public.customer_accounts"));expect(canonical.toLowerCase()).not.toContain("stripe")});
});
