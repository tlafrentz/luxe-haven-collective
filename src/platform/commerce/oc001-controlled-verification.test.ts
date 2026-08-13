import{readFileSync}from"node:fs";import{describe,expect,it}from"vitest";
const sql=readFileSync("supabase/migrations/20260812132000_oc001_controlled_purchase_verification.sql","utf8");
const testMode=readFileSync("supabase/migrations/20260812133000_oc001_controlled_test_purchase.sql","utf8");
describe("OC-001 controlled purchase verification",()=>{
 it("requires the service boundary, active verifier, controlled customer, membership, and product scope",()=>{for(const value of["auth.role()<>'service_role'","identity_type_code='release_verifier'","controlled_verification_identities","customer_account_memberships","OC001_CONTROLLED_PRODUCT_SCOPE_INVALID"])expect(sql).toContain(value)});
 it("keeps offers unpublished while resolving exact live mappings",()=>{expect(sql).toContain("o.status='draft'");expect(sql).toContain("d.launch_state<>'deferred'");expect(sql).toContain("m.account_mode='live'");expect(sql).toContain("m.amount_minor=v.amount_minor");expect(sql).not.toMatch(/insert into public\.commercial_catalog_publications|status='published'/)});
 it("does not manufacture payment, activation, entitlements, or onboarding",()=>{expect(sql).not.toMatch(/insert into public\.(commercial_agreements|commercial_entitlements|onboarding_cases)|payment_status|invoice_paid/)});
  it("is idempotent and records only safe audit metadata",()=>{expect(sql).toContain("idempotency_key_hash=p_idempotency_hash");expect(sql).toContain("OC001_IDEMPOTENCY_CONFLICT");expect(sql).not.toMatch(/email|address|card|document|filename|provider_payload/i)});
  it("isolates test-mode purchases from live mappings and public publication",()=>{expect(testMode).toContain("m.account_mode='test'");expect(testMode).toContain("o.status='draft'");expect(testMode).not.toMatch(/commercial_catalog_publications|m\.account_mode='live'|insert into public\.commercial_entitlements/)});
});
