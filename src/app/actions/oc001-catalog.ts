"use server";
import "server-only";
import { requireRole } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeCommerceConfig, PublishOc001Offer, ReconcileOc001StripeMapping, RegisterOc001Catalog, StripeCommerceProvider } from "@/platform/commerce";
export async function registerOc001Catalog(){const{user}=await requireRole(["admin"]);return new RegisterOc001Catalog(createAdminClient()).execute({actorId:user.id,correlationId:crypto.randomUUID()})}
export async function publishOc001Offer(input:Readonly<{offerCode:string;offerVersion:number;verificationReference:string;expectedStatus:"draft"|"approved"}>){const{user}=await requireRole(["admin"]);return new PublishOc001Offer(createAdminClient()).execute({...input,actorId:user.id,correlationId:crypto.randomUUID()})}
export async function reconcileOc001StripeMapping(input:Readonly<{priceCode:string;priceVersion:number;stripePriceReference:string}>){const{user}=await requireRole(["admin"]),provider=new StripeCommerceProvider(getStripeCommerceConfig());return new ReconcileOc001StripeMapping(createAdminClient(),id=>provider.getCatalogPrice(id)).execute({...input,actorId:user.id,correlationId:crypto.randomUUID()})}
