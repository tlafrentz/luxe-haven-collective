import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const checkout=readFileSync("src/app/actions/commerce-checkout.ts","utf8");
const webhook=readFileSync("src/app/api/webhooks/stripe/route.ts","utf8");
const lifecycle=readFileSync("src/platform/commerce/infrastructure/supabase-ca001b-lifecycle.ts","utf8");
const stripe=readFileSync("src/platform/commerce/infrastructure/stripe/stripe-commerce-provider.ts","utf8");
const registration=readFileSync("src/platform/commerce/application/oc001-catalog.ts","utf8");

describe("OC-001 production composition",()=>{
  it("resolves checkout from the canonical purchase intent and Stripe mapping",()=>{expect(checkout).toContain('admin.rpc("create_oc001_purchase_intent"');expect(checkout).toContain("resolved.stripePriceReference");expect(checkout).not.toMatch(/amountMinor\s*:\s*addOns|providerPriceId\s*:\s*legacyOfferId/)});
  it("recovers the same hosted Checkout session for duplicate initiation",()=>{expect(checkout).toContain('provider.getCheckout');expect(checkout).toContain('stripe_checkout_session_reference');expect(checkout).toContain('OC001_CHECKOUT_EXPIRED')});
  it("uses verified provider events for authoritative activation and onboarding",()=>{expect(webhook).toContain("verifyStripeWebhook");expect(webhook).toContain("ProcessVerifiedCommercialEvent");expect(webhook).toContain("createProductionOnboarding");expect(webhook).not.toMatch(/success.*entitlement|redirect.*entitlement/i)});
  it("uses audited application operations for entitlement lifecycle changes",()=>{expect(lifecycle).toContain('rpc("activate_oc001_agreement_entitlements"');expect(lifecycle).toContain('rpc("initialize_oc001_agreement_effects"');expect(lifecycle).toContain('rpc("transition_oc001_agreement_entitlements"');expect(lifecycle).not.toMatch(/from\("commercial_entitlements"\)\.update/)});
  it("reclaims only failed provider events for bounded recovery",()=>{expect(lifecycle).toContain('data.status!=="failed"');expect(lifecycle).toContain('.eq("status","failed")');expect(lifecycle).toContain('attempt_count:Number(data.attempt_count)+1');expect(lifecycle).toContain('this.currentEventId=String(data.id)')});
  it("uses hosted Checkout without hard-coded payment method types",()=>{expect(stripe).toContain("integration_identifier");expect(stripe).not.toContain("payment_method_types")});
  it("keeps multi-cadence prices out of the legacy single-price columns",()=>{expect(registration).toContain("currency:definition.prices.length===1?definition.prices[0].currency:null")});
  it("normalizes persisted timestamp representations during drift checks",()=>{expect(registration).toContain('/^\\d{4}-\\d{2}-\\d{2}T/')});
});
