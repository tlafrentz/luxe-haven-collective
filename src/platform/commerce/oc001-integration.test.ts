import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const checkout=readFileSync("src/app/actions/commerce-checkout.ts","utf8");
const webhook=readFileSync("src/app/api/webhooks/stripe/route.ts","utf8");
const lifecycle=readFileSync("src/platform/commerce/infrastructure/supabase-ca001b-lifecycle.ts","utf8");
const stripe=readFileSync("src/platform/commerce/infrastructure/stripe/stripe-commerce-provider.ts","utf8");
const registration=readFileSync("src/platform/commerce/application/oc001-catalog.ts","utf8");
const rpcCall=(source:string,name:string)=>new RegExp(`(?:this\\.client|admin|client)\\.rpc\\(\\s*["']${name}["']`).test(source);

describe("OC-001 production composition",()=>{
  it("resolves checkout from the canonical purchase intent and Stripe mapping",()=>{expect(checkout).toContain('admin.rpc("create_oc001_purchase_intent"');expect(checkout).toContain("resolved.stripePriceReference");expect(checkout).not.toMatch(/amountMinor\s*:\s*addOns|providerPriceId\s*:\s*legacyOfferId/)});
  it("recovers the same hosted Checkout session for duplicate initiation",()=>{expect(checkout).toContain('provider.getCheckout');expect(checkout).toContain('stripe_checkout_session_reference');expect(checkout).toContain('OC001_CHECKOUT_EXPIRED')});
  it("uses verified provider events for authoritative activation and onboarding",()=>{expect(webhook).toContain("verifyStripeWebhook");expect(webhook).toContain("ProcessVerifiedCommercialEvent");expect(webhook).toContain("createProductionOnboarding");expect(webhook).not.toMatch(/success.*entitlement|redirect.*entitlement/i)});
  it("uses audited application operations for entitlement lifecycle changes",()=>{expect(rpcCall(lifecycle,"activate_oc001_agreement_entitlements")).toBe(true);expect(rpcCall(lifecycle,"initialize_oc001_agreement_effects")).toBe(true);expect(rpcCall(lifecycle,"transition_oc001_agreement_entitlements")).toBe(true);expect(lifecycle).not.toMatch(/from\(["']commercial_entitlements["']\)\s*\.update/);expect(lifecycle).not.toMatch(/from\(["']commercial_entitlements["']\)\s*\.insert/)});
  it("reclaims only failed provider events for bounded recovery",()=>{expect(lifecycle).toMatch(/data\.status\s*!==\s*["']failed["']/);expect(lifecycle).toMatch(/\.eq\(["']status["']\s*,\s*["']failed["']\)/);expect(lifecycle).toMatch(/attempt_count\s*:\s*Number\(data\.attempt_count\)\s*\+\s*1/);expect(lifecycle).toContain("this.currentEventId");expect(lifecycle).not.toMatch(/\.in\(["']status["']/);});
  it("rejects unsafe OC-001 source patterns",()=>{const direct='from("commercial_entitlements").update({status:"active"})';const wrong='this.client.rpc("wrong_entitlement_operation", {})';const broad='.in("status", ["failed", "pending"])';expect(direct).toMatch(/from\(["']commercial_entitlements["']\)\s*\.update/);expect(rpcCall(wrong,"activate_oc001_agreement_entitlements")).toBe(false);expect(broad).toMatch(/\.in\(["']status["']/);});
  it("uses hosted Checkout without hard-coded payment method types",()=>{expect(stripe).toContain("integration_identifier");expect(stripe).not.toContain("payment_method_types")});
  it("keeps multi-cadence prices out of the legacy single-price columns",()=>{expect(registration).toContain("currency:definition.prices.length===1?definition.prices[0].currency:null")});
  it("normalizes persisted timestamp representations during drift checks",()=>{expect(registration).toContain('/^\\d{4}-\\d{2}-\\d{2}T/')});
});
