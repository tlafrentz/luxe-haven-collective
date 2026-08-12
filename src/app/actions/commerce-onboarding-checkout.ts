"use server";
import { beginCommerceCheckout } from "@/app/actions/commerce-checkout";
import { plansBySlug, resolvePlanOfferId, type PlanSlug } from "@/lib/plans";
import type { BillingCycle } from "@/components/marketing/billing-toggle";

export type BeginOnboardingCheckoutResult={redirectUrl:string}|{error:string};
export async function beginCommerceOnboardingCheckout(planSlug:string,billing:BillingCycle):Promise<BeginOnboardingCheckoutResult>{const plan=plansBySlug[planSlug as PlanSlug];if(!plan)return{error:"OFFER_UNAVAILABLE"};const offerId=resolvePlanOfferId(plan,billing);if(!offerId)return{error:"OFFER_UNAVAILABLE"};try{await beginCommerceCheckout(offerId,undefined,{successPath:`/commerce/complete?plan=${plan.slug}`,cancelPath:`/commerce/checkout/cancelled?plan=${plan.slug}`});return{error:"NO_REDIRECT_URL"}}catch(error){const code=error instanceof Error?error.message:"OC001_CHECKOUT_UNAVAILABLE";if(code.startsWith("NEXT_REDIRECT"))throw error;return{error:code}}}
