"use server";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  getStripeCommerceConfig,
  StripeCommerceProvider,
  type BillingWorkspace,
  type CommerceInvoice,
  type CommerceSubscription,
} from "@/platform/commerce";

export async function getBillingWorkspace(): Promise<BillingWorkspace> {
  const client=await createClient(),{data:{user}}=await client.auth.getUser();
  if(!user)return Object.freeze({invoices:[],recentActivity:[],synchronization:{state:"unavailable"}});
  const{data:customer}=await client.from("commerce_customers").select("id,workspace_id").eq("profile_id",user.id).maybeSingle();
  if(!customer?.workspace_id)return Object.freeze({invoices:[],recentActivity:[],synchronization:{state:"unavailable"}});
  const[{data:subscription},{data:invoices},{data:history},{data:paymentMethod}]=await Promise.all([
    client.from("commerce_subscriptions").select("*").eq("workspace_id",customer.workspace_id).order("updated_at",{ascending:false}).limit(1).maybeSingle(),
    client.from("commerce_invoices").select("*").eq("workspace_id",customer.workspace_id).order("created_at",{ascending:false}).limit(100),
    client.from("commerce_subscription_history").select("event_type,resulting_status,occurred_at").order("occurred_at",{ascending:false}).limit(20),
    client.from("commerce_payment_method_summaries").select("brand,last_four,expiration_month,expiration_year").eq("customer_id",customer.id).maybeSingle(),
  ]);
  const mappedSubscription=subscription?mapSubscription(subscription):undefined;
  const mappedInvoices=(invoices??[]).map(mapInvoice);
  const lastSync=mappedSubscription?.lastSynchronizedAt;
  return Object.freeze({
    ...(mappedSubscription?{subscription:mappedSubscription}:{}),
    invoices:Object.freeze(mappedInvoices),
    ...(paymentMethod?{paymentMethod:Object.freeze({brand:paymentMethod.brand,lastFour:paymentMethod.last_four,expirationMonth:paymentMethod.expiration_month,expirationYear:paymentMethod.expiration_year})}:{}),
    recentActivity:Object.freeze((history??[]).map(item=>Object.freeze({type:item.event_type,summary:`Subscription became ${item.resulting_status}.`,occurredAt:new Date(item.occurred_at)}))),
    synchronization:Object.freeze({state:mappedSubscription?"current":"partial",...(lastSync?{lastSynchronizedAt:lastSync}:{})}),
  });
}

export async function launchBillingPortal() {
  const client=await createClient(),{data:{user}}=await client.auth.getUser();if(!user)redirect("/login?next=/dashboard/billing");
  const{data:customer}=await client.from("commerce_customers").select("id,workspace_id,stripe_customer_id").eq("profile_id",user.id).maybeSingle();
  if(!customer?.workspace_id||!customer.stripe_customer_id)throw new Error("Billing profile is unavailable.");
  const config=getStripeCommerceConfig(),provider=new StripeCommerceProvider(config),baseUrl=process.env.NEXT_PUBLIC_SITE_URL??"http://localhost:3000";
  const portal=await provider.createBillingPortalSession({providerCustomerId:customer.stripe_customer_id,returnUrl:`${baseUrl}/dashboard/billing`,configurationId:process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID,idempotencyKey:`billing-portal:${customer.id}:${crypto.randomUUID()}`});
  const admin=createAdminClient(),{error}=await admin.from("commerce_billing_portal_sessions").insert({id:`commerce-portal-${crypto.randomUUID()}`,customer_id:customer.id,workspace_id:customer.workspace_id,provider:"stripe",environment:config.environment,provider_portal_session_id:portal.id,return_url:`${baseUrl}/dashboard/billing`,status:"created",expires_at:portal.expiresAt?.toISOString()??null,created_at:new Date().toISOString()});
  if(error)throw new Error("Billing Portal session could not be persisted.");
  redirect(portal.url);
}

function mapSubscription(row:Record<string,unknown>):CommerceSubscription{return Object.freeze({id:String(row.id),customerId:String(row.customer_id),workspaceId:String(row.workspace_id),productId:String(row.product_id),...(row.offer_id?{offerId:String(row.offer_id)}:{}),priceId:String(row.price_id),provider:"stripe",environment:row.environment==="live"?"live":"test",providerSubscriptionId:String(row.provider_subscription_id),status:row.status as CommerceSubscription["status"],currentPeriodStart:new Date(String(row.current_period_start)),currentPeriodEnd:new Date(String(row.current_period_end)),cancelAtPeriodEnd:Boolean(row.cancel_at_period_end),revision:Number(row.revision),lastSynchronizedAt:new Date(String(row.last_synchronized_at)),createdAt:new Date(String(row.created_at)),updatedAt:new Date(String(row.updated_at))})}
function mapInvoice(row:Record<string,unknown>):CommerceInvoice{return Object.freeze({id:String(row.id),subscriptionId:String(row.subscription_id),customerId:String(row.customer_id),workspaceId:String(row.workspace_id),provider:"stripe",environment:row.environment==="live"?"live":"test",providerInvoiceId:String(row.provider_invoice_id),...(row.invoice_number?{number:String(row.invoice_number)}:{}),amountMinor:Number(row.amount_minor),currency:String(row.currency),status:row.status as CommerceInvoice["status"],...(row.hosted_invoice_url?{invoiceUrl:String(row.hosted_invoice_url)}:{}),...(row.invoice_pdf_url?{receiptUrl:String(row.invoice_pdf_url)}:{}),...(row.period_start?{periodStart:new Date(String(row.period_start))}:{}),...(row.period_end?{periodEnd:new Date(String(row.period_end))}:{}),...(row.due_at?{dueAt:new Date(String(row.due_at))}:{}),...(row.paid_at?{paidAt:new Date(String(row.paid_at))}:{}),createdAt:new Date(String(row.created_at))})}
