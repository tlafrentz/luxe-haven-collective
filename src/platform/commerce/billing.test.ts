import { describe, expect, it, vi } from "vitest";
import { normalizeStripeWebhookEvent, StripeCommerceProvider } from ".";

const envelope=(type:string,object:Record<string,unknown>,livemode=false)=>({id:`evt_${type}`,type,created:1_785_000_000,livemode,data:{object}});

describe("Commerce Billing",()=>{
 it("normalizes subscription lifecycle and item billing periods",()=>{
  const event=normalizeStripeWebhookEvent(envelope("customer.subscription.updated",{id:"sub_1",customer:"cus_1",status:"past_due",cancel_at_period_end:true,metadata:{workspace_id:"00000000-0000-0000-0000-000000000001"},items:{data:[{current_period_start:1_784_000_000,current_period_end:1_786_000_000,price:{id:"price_1",product:"prod_1"}}]}}),"test");
  expect(event).toMatchObject({eventType:"subscription.updated",providerSubscriptionId:"sub_1",subscriptionStatus:"past-due",providerPriceId:"price_1",providerProductId:"prod_1",cancelAtPeriodEnd:true});
  expect(event.currentPeriodEnd?.getTime()).toBe(1_786_000_000_000);
 });
 it("normalizes invoice history and allows only Stripe-hosted document URLs",()=>{
  const event=normalizeStripeWebhookEvent(envelope("invoice.paid",{id:"in_1",customer:"cus_1",subscription:"sub_1",number:"LHC-001",status:"paid",total:24900,currency:"usd",hosted_invoice_url:"https://invoice.stripe.com/i/test",invoice_pdf:"https://pay.stripe.com/invoice.pdf",period_start:1_784_000_000,period_end:1_786_000_000}),"test");
  expect(event).toMatchObject({eventType:"invoice.paid",providerInvoiceId:"in_1",providerSubscriptionId:"sub_1",invoiceNumber:"LHC-001",invoiceStatus:"paid",amountMinor:24900,currency:"USD"});
  const unsafe=normalizeStripeWebhookEvent(envelope("invoice.updated",{id:"in_2",customer:"cus_1",subscription:"sub_1",status:"open",total:100,currency:"usd",hosted_invoice_url:"https://evil.example/invoice"}),"test");
  expect(unsafe.invoiceUrl).toBeUndefined();
 });
 it("creates a short-lived hosted Billing Portal session server-side",async()=>{
  const fetcher=vi.fn(async()=>new Response(JSON.stringify({id:"bps_1",url:"https://billing.stripe.com/p/session",created:1_785_000_000}),{status:200})) as unknown as typeof fetch;
  const provider=new StripeCommerceProvider({apiKey:"rk_test_x",environment:"test",apiVersion:"2026-06-24.dahlia"},fetcher);
  const session=await provider.createBillingPortalSession({providerCustomerId:"cus_1",returnUrl:"https://luxehavenco.com/dashboard/billing",configurationId:"bpc_1",idempotencyKey:"portal-1"});
  expect(session.url).toContain("billing.stripe.com");
  const request=(fetcher as ReturnType<typeof vi.fn>).mock.calls[0];
  expect(request[0]).toBe("https://api.stripe.com/v1/billing_portal/sessions");
  expect(String(request[1]?.body)).toContain("customer=cus_1");
  expect(String(request[1]?.body)).toContain("configuration=bpc_1");
 });
 it("retains only a safe payment method summary",()=>{
  const event=normalizeStripeWebhookEvent(envelope("payment_method.updated",{id:"pm_1",customer:"cus_1",card:{brand:"visa",last4:"4242",exp_month:12,exp_year:2030}}),"test");
  expect(event).toMatchObject({eventType:"billing.payment-method-updated",providerPaymentMethodId:"pm_1",paymentMethodBrand:"visa",paymentMethodLastFour:"4242",paymentMethodExpirationMonth:12,paymentMethodExpirationYear:2030});
  expect(event).not.toHaveProperty("card");
 });
 it("keeps subscription Checkout distinct from entitlement activation",()=>{
  const event=normalizeStripeWebhookEvent(envelope("checkout.session.completed",{id:"cs_1",mode:"subscription",customer:"cus_1",subscription:"sub_1",payment_status:"paid",metadata:{order_id:"order_1"}}),"test");
  expect(event.eventType).toBe("subscription.checkout.completed");
  expect(event).not.toHaveProperty("entitlements");
 });
});
