import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  CommercePaymentError,
  getStripeWebhookConfig,
  normalizeStripeWebhookEvent,
  ProcessVerifiedCommercialEvent,
  SupabaseCommercialLifecycleRepository,
  verifyStripeWebhook,
} from "@/platform/commerce";
import { createProductionOnboarding } from "@/platform/onboarding";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  let normalized;
  try {
    const config = getStripeWebhookConfig();
    const verified = await verifyStripeWebhook({
      rawBody,
      signatureHeader: request.headers.get("stripe-signature"),
      secret: config.secret,
    });
    normalized = normalizeStripeWebhookEvent(verified, config.environment);
  } catch (error) {
    const code = error instanceof CommercePaymentError ? error.code : "commerce_webhook_processing_failed";
    return NextResponse.json({ accepted: false, code }, { status: 400 });
  }

  const client = createAdminClient();
  if(normalized.providerSubscriptionId&&normalized.eventType.startsWith("invoice.")){
    const{data:renewal}=await client.from("guidebook_hosting_renewal_obligations").select("id").eq("provider_subscription_reference",normalized.providerSubscriptionId).maybeSingle();
    if(renewal&&(normalized.eventType==="invoice.paid"||normalized.eventType==="invoice.payment-failed")){
      if(!normalized.currentPeriodStart||!normalized.currentPeriodEnd)return NextResponse.json({accepted:true,status:"review_required",code:"OC001_GUIDEBOOK_RENEWAL_PERIOD_MISSING"});
      const{data,error}=await client.rpc("apply_oc001_guidebook_hosting_renewal",{p_provider_subscription_reference:normalized.providerSubscriptionId,p_period_start:normalized.currentPeriodStart.toISOString(),p_period_end:normalized.currentPeriodEnd.toISOString(),p_paid:normalized.eventType==="invoice.paid"});
      return NextResponse.json({accepted:!error,status:error?"review_required":"processed",...(error?{code:"OC001_GUIDEBOOK_RENEWAL_RECONCILIATION_REQUIRED"}:{result:data})});
    }
  }
  let purchaseIntentId=normalized.metadata.purchase_intent_id;
  if(!purchaseIntentId&&normalized.providerSubscriptionId){const{data:agreement}=await client.from("commercial_agreements").select("checkout_attempt_id").eq("provider_agreement_reference",normalized.providerSubscriptionId).maybeSingle();if(agreement?.checkout_attempt_id){const{data:intent}=await client.from("commercial_purchase_intents").select("id").eq("checkout_attempt_id",agreement.checkout_attempt_id).maybeSingle();purchaseIntentId=intent?.id}}
  if(purchaseIntentId){
    const{data:intent,error:intentError}=await client.from("commercial_purchase_intents").select("id,tenant_id,customer_account_id,checkout_attempt_id,status,offer_code").eq("id",purchaseIntentId).maybeSingle();
    if(intentError||!intent?.checkout_attempt_id)return NextResponse.json({accepted:false,code:"commerce_webhook_processing_failed"},{status:503});
    if(intent.offer_code==="FS-DESIGN"&&normalized.amountMinor!==undefined){const{data:approval}=await client.from("commercial_configuration_approvals").select("amount_minor,configuration_checksum").eq("purchase_intent_id",intent.id).maybeSingle();if(!approval||Number(approval.amount_minor)!==normalized.amountMinor)return NextResponse.json({accepted:true,status:"review_required",code:"OC001_FURNISHING_AMOUNT_MISMATCH"})}
    const processor=new ProcessVerifiedCommercialEvent({mode:normalized.environment,repository:new SupabaseCommercialLifecycleRepository(client),checksum:async value=>createHash("sha256").update(value).digest("hex")});
    try{
      const outcome=await processor.execute({providerEventId:normalized.providerEventId,accountMode:normalized.environment,eventType:normalized.providerEventType,occurredAt:normalized.providerCreatedAt.toISOString(),providerCustomerReference:normalized.providerCustomerId??"",...(normalized.providerSubscriptionId?{providerAgreementReference:normalized.providerSubscriptionId}:{}),checkoutAttemptId:String(intent.checkout_attempt_id),...(normalized.subscriptionStatus?{subscriptionStatus:normalized.subscriptionStatus.replace("past-due","past_due").replace("cancelled","canceled")}:{}),invoicePaid:normalized.eventType==="invoice.paid",paymentSucceeded:normalized.paymentStatus==="succeeded",...(normalized.cancelAtPeriodEnd!==undefined?{cancelAtPeriodEnd:normalized.cancelAtPeriodEnd}:{}),...(normalized.currentPeriodStart?{periodStart:normalized.currentPeriodStart.toISOString()}:{}),...(normalized.currentPeriodEnd?{periodEnd:normalized.currentPeriodEnd.toISOString()}:{}),});
      const{data:resolvedAgreement}=await client.from("commercial_agreements").select("id,status,offer_code").eq("checkout_attempt_id",intent.checkout_attempt_id).maybeSingle();if(resolvedAgreement?.status==="active"){if(resolvedAgreement.offer_code==="FS-DESIGN")await client.rpc("consume_oc001_furnishing_configuration",{p_purchase_intent_id:purchaseIntentId,p_agreement_id:resolvedAgreement.id});const{data:member}=await client.from("customer_account_memberships").select("profile_id").eq("tenant_id",intent.tenant_id).eq("customer_account_id",intent.customer_account_id).eq("status","active").order("created_at").limit(1).maybeSingle();if(member)await createProductionOnboarding().assemble.execute({actorId:String(member.profile_id),tenantId:String(intent.tenant_id),customerAccountId:String(intent.customer_account_id),sourceType:"commercial_agreement",sourceReferenceId:String(resolvedAgreement.id),correlationId:normalized.providerEventId,idempotencyKey:`oc001:onboarding:${resolvedAgreement.id}`})}
      return NextResponse.json({accepted:true,status:outcome.status});
    }catch{return NextResponse.json({accepted:true,status:"review_required",code:"RECONCILIATION_REQUIRED"})}
  }
  const receiptId = `commerce-receipt-${normalized.providerEventId}`;
  const serialized = {
    ...normalized,
    providerCreatedAt: normalized.providerCreatedAt.toISOString(),
  };
  const { error: receiptError } = await client.from("commerce_webhook_receipts").upsert({
    id: receiptId,
    provider: normalized.provider,
    environment: normalized.environment,
    provider_event_id: normalized.providerEventId,
    provider_event_type: normalized.providerEventType,
    provider_created_at: normalized.providerCreatedAt.toISOString(),
    normalized_event_type: normalized.eventType,
    normalized_event: serialized,
    status: "verified",
    received_at: new Date().toISOString(),
    verified_at: new Date().toISOString(),
  }, { onConflict: "provider,environment,provider_event_id", ignoreDuplicates: true });
  if (receiptError) {
    return NextResponse.json({ accepted: false, code: "commerce_webhook_processing_failed" }, { status: 503 });
  }

  const billingEvent = (normalized.eventType.startsWith("subscription.") && normalized.eventType !== "subscription.checkout.completed")
    || normalized.eventType.startsWith("invoice.") || normalized.eventType.startsWith("billing.");
  const { data, error } = await client.rpc(
    billingEvent ? "process_commerce_billing_event" : "process_commerce_provider_event",
    { p_event: serialized },
  );
  if (error) {
    return NextResponse.json({ accepted: false, code: "commerce_webhook_processing_failed" }, { status: 503 });
  }
  const result = data as { status?: string; errorCode?: string };
  if (result.status === "processed") {
    // Bounded process-manager handoff. Payment/Billing truth has already committed.
    await client.rpc("process_pending_commerce_fulfillment", { p_limit: 20 });
  }
  // A verified event is safely accepted even when business reconciliation needs operator review.
  return NextResponse.json({
    accepted: true,
    status: result.status ?? "processed",
    ...(result.errorCode ? { code: result.errorCode } : {}),
  });
}
