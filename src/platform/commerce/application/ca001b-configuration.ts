import { BillingActivationError,type BillingPriceMapping,type StripeAccountMode } from "../domain/ca001b-billing";
import type { OfferDefinition } from "../domain/commercial-catalog";

export type BillingProductionConfiguration=Readonly<{checkoutEnabled:boolean;subscriptionsEnabled:boolean;oneTimePaymentsEnabled:boolean;customerPortalEnabled:boolean;checkoutSessionTtlSeconds:number;webhookToleranceSeconds:number;reconciliationLookbackDays:number;checkoutSuccessUrl:string;checkoutCancelUrl:string;customerPortalReturnUrl:string;stripeApiVersion:"2026-06-24.dahlia";stripeAccountMode:StripeAccountMode}>;
export type BillingServerSecrets=Readonly<{apiKey:string;webhookSecret:string}>;
const bool=(value:string|undefined)=>value==="true";
export function loadBillingComposition(env:Readonly<Record<string,string|undefined>>=process.env):Readonly<{configuration:BillingProductionConfiguration;secrets:BillingServerSecrets}>{
 const mode=env.STRIPE_ENVIRONMENT==="live"?"live":env.STRIPE_ENVIRONMENT==="test"?"test":env.VERCEL_ENV==="production"?"live":"test";
 const origin=approvedOrigin(env.NEXT_PUBLIC_SITE_URL??"http://localhost:3000",env.VERCEL_ENV==="production");
 const apiKey=env.STRIPE_SECRET_KEY?.trim()??"",webhookSecret=env.STRIPE_WEBHOOK_SECRET?.trim()??"";
 const checkoutEnabled=bool(env.COMMERCE_CHECKOUT_ENABLED);
 if(checkoutEnabled&&(!apiKey||!webhookSecret))throw new BillingActivationError("CHECKOUT_DISABLED","Billing credentials are unavailable.");
 if(apiKey&&!apiKey.startsWith(mode==="live"?"rk_live_":"rk_test_")&&!apiKey.startsWith(mode==="live"?"sk_live_":"sk_test_"))throw new BillingActivationError("BILLING_ENVIRONMENT_MISMATCH","Billing credential environment mismatch.");
 if(webhookSecret&&!webhookSecret.startsWith("whsec_"))throw new BillingActivationError("CHECKOUT_DISABLED","Webhook signing configuration is invalid.");
 const integer=(key:string,fallback:number,min:number,max:number)=>{const value=Number(env[key]??fallback);if(!Number.isSafeInteger(value)||value<min||value>max)throw new BillingActivationError("CHECKOUT_DISABLED","Billing timing configuration is invalid.");return value};
 return Object.freeze({configuration:Object.freeze({checkoutEnabled,subscriptionsEnabled:bool(env.COMMERCE_SUBSCRIPTIONS_ENABLED),oneTimePaymentsEnabled:bool(env.COMMERCE_ONE_TIME_PAYMENTS_ENABLED),customerPortalEnabled:bool(env.COMMERCE_CUSTOMER_PORTAL_ENABLED),checkoutSessionTtlSeconds:integer("COMMERCE_CHECKOUT_TTL_SECONDS",1800,1800,86400),webhookToleranceSeconds:integer("STRIPE_WEBHOOK_TOLERANCE_SECONDS",300,60,900),reconciliationLookbackDays:integer("COMMERCE_RECONCILIATION_LOOKBACK_DAYS",30,1,90),checkoutSuccessUrl:`${origin}/commerce/complete`,checkoutCancelUrl:`${origin}/commerce/checkout/cancelled`,customerPortalReturnUrl:`${origin}/dashboard/billing`,stripeApiVersion:"2026-06-24.dahlia",stripeAccountMode:mode}),secrets:Object.freeze({apiKey,webhookSecret})});
}
export function checkoutAvailability(configuration:BillingProductionConfiguration){return Object.freeze({checkoutAvailable:configuration.checkoutEnabled,subscriptionsAvailable:configuration.checkoutEnabled&&configuration.subscriptionsEnabled,oneTimePaymentsAvailable:configuration.checkoutEnabled&&configuration.oneTimePaymentsEnabled,customerPortalAvailable:configuration.customerPortalEnabled})}
export function validateBillingPriceMapping(offer:OfferDefinition,mapping:BillingPriceMapping,mode:StripeAccountMode,asOf=new Date()):BillingPriceMapping{
 if(mapping.status!=="active"||Date.parse(mapping.effectiveFrom)>asOf.getTime()||(mapping.effectiveUntil&&Date.parse(mapping.effectiveUntil)<=asOf.getTime()))throw new BillingActivationError("BILLING_PRICE_MAPPING_MISSING","No active billing price is available.");
 if(mapping.offerCode!==offer.code||mapping.offerVersion!==offer.version||mapping.stripeAccountMode!==mode)throw new BillingActivationError("BILLING_ENVIRONMENT_MISMATCH","The billing mapping does not match this offer environment.");
 if(offer.billingModel!==mapping.billingModel||!offer.priceDefinition||offer.priceDefinition.currency!==mapping.currency||offer.priceDefinition.amountMinor!==mapping.amountMinor||offer.priceDefinition.interval!==mapping.interval||(offer.priceDefinition.intervalCount??1)!==(mapping.intervalCount??1))throw new BillingActivationError("BILLING_PRICE_MAPPING_MISMATCH","The approved offer and billing price do not match.");
 if(!mapping.stripePriceId.startsWith("price_")||!mapping.stripeProductId.startsWith("prod_"))throw new BillingActivationError("BILLING_PRICE_MAPPING_MISMATCH","The billing provider mapping is malformed.");
 return mapping;
}
function approvedOrigin(value:string,production:boolean):string{let url:URL;try{url=new URL(value)}catch{throw new BillingActivationError("CHECKOUT_DISABLED","The application origin is invalid.")}if(url.username||url.password||url.search||url.hash||url.pathname!=="/"||(production&&url.protocol!=="https:")||(production&&!(["luxehavenco.com","www.luxehavenco.com"].includes(url.hostname))))throw new BillingActivationError("CHECKOUT_DISABLED","The application origin is not approved.");return url.origin}
