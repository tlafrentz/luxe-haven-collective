import type { CommerceEnvironment, ProviderCheckout } from "./checkout";

export type SubscriptionItemResult=Readonly<{subscriptionId:string;subscriptionItemId?:string;quantity:number;status:"active"|"inactive"}>;
export type DelayedRenewalResult=Readonly<{subscriptionId:string;trialEndsAt:Date;status:"trialing"}>;

export interface Oc001SpecialCommerceProvider{
 setSubscriptionItem(input:Readonly<{subscriptionId:string;priceId:string;quantity:number;existingSubscriptionItemId?:string;metadata:Readonly<Record<string,string>>;idempotencyKey:string}>):Promise<SubscriptionItemResult>;
 createDelayedSubscription(input:Readonly<{customerId:string;priceId:string;trialEndsAt:Date;metadata:Readonly<Record<string,string>>;idempotencyKey:string}>):Promise<DelayedRenewalResult>;
 createAuthoritativeAmountCheckout(input:Readonly<{customerId:string;productId:string;name:string;amountMinor:number;currency:"USD";successUrl:string;cancelUrl:string;metadata:Readonly<Record<string,string>>;idempotencyKey:string}>):Promise<ProviderCheckout>;
}

export interface Oc001SpecialPurchaseRepository{
 claimHpmPropertyAddon(input:Readonly<{actorId:string;tenantId:string;customerAccountId:string;quantity:number;idempotencyKey:string;correlationId:string}>):Promise<Readonly<{operationId:string;status:string;quantity:number;providerSubscriptionReference:string;providerSubscriptionItemReference?:string}>>;
 completeHpmPropertyAddon(input:Readonly<{operationId:string;providerSubscriptionItemReference?:string;providerQuantity:number;providerStatus:string;failureCode?:string}>):Promise<unknown>;
 claimGuidebookRenewal(input:Readonly<{actorId:string;tenantId:string;customerAccountId:string;guidebookId:string;environment:CommerceEnvironment;idempotencyKey:string;correlationId:string}>):Promise<Readonly<{obligationId:string;status:string;renewalAt:string;providerCustomerReference:string;providerPriceReference:string;providerSubscriptionReference?:string}>>;
 completeGuidebookRenewalSchedule(input:Readonly<{obligationId:string;providerSubscriptionReference:string;providerTrialEnd:string}>):Promise<unknown>;
 createFurnishingPurchaseIntent(input:Readonly<{actorId:string;approvalId:string;expectedRevision:number;environment:CommerceEnvironment;idempotencyHash:string;correlationId:string}>):Promise<Readonly<{purchaseIntentId:string;status:string;amountMinor:number;currency:"USD";configurationChecksum:string;providerProductReference:string}>>;
 attachCheckout(input:Readonly<{actorId:string;purchaseIntentId:string;attemptId:string;sessionReference:string;customerReference:string;expiresAt:string;idempotencyHash:string;correlationId:string}>):Promise<unknown>;
}

export async function changeHpmGrowthPropertyCapacity(deps:Readonly<{repository:Oc001SpecialPurchaseRepository;provider:Oc001SpecialCommerceProvider;propertyPriceId:string}>,input:Readonly<{actorId:string;tenantId:string;customerAccountId:string;quantity:number;idempotencyKey:string;correlationId:string}>){
 const claim=await deps.repository.claimHpmPropertyAddon(input);
 if(claim.status==="completed")return claim;
 const applied=await deps.provider.setSubscriptionItem({subscriptionId:claim.providerSubscriptionReference,priceId:deps.propertyPriceId,quantity:claim.quantity,...(claim.providerSubscriptionItemReference?{existingSubscriptionItemId:claim.providerSubscriptionItemReference}:{}),metadata:{operation_id:claim.operationId,offer_code:"HPM-GROWTH-PROPERTY"},idempotencyKey:`${input.idempotencyKey}:provider`});
 await deps.repository.completeHpmPropertyAddon({operationId:claim.operationId,...(applied.subscriptionItemId?{providerSubscriptionItemReference:applied.subscriptionItemId}:{}),providerQuantity:applied.quantity,providerStatus:applied.status});
 if(applied.status!=="active"||applied.quantity!==claim.quantity)throw new Error("OC001_HPM_ADDON_RECONCILIATION_REQUIRED");
 return Object.freeze({...claim,status:"completed" as const,quantity:applied.quantity});
}

export async function scheduleGuidebookHostingRenewal(deps:Readonly<{repository:Oc001SpecialPurchaseRepository;provider:Oc001SpecialCommerceProvider;environment:CommerceEnvironment}>,input:Readonly<{actorId:string;tenantId:string;customerAccountId:string;guidebookId:string;idempotencyKey:string;correlationId:string}>){
 const claim=await deps.repository.claimGuidebookRenewal({...input,environment:deps.environment});
 if(claim.status==="scheduled"||claim.status==="active")return claim;
 const renewalAt=new Date(claim.renewalAt);if(!Number.isFinite(renewalAt.getTime())||renewalAt.getTime()<=Date.now())throw new Error("OC001_GUIDEBOOK_RENEWAL_DATE_INVALID");
 const scheduled=await deps.provider.createDelayedSubscription({customerId:claim.providerCustomerReference,priceId:claim.providerPriceReference,trialEndsAt:renewalAt,metadata:{renewal_obligation_id:claim.obligationId,guidebook_id:input.guidebookId,offer_code:"GB-HOSTING-RENEWAL"},idempotencyKey:`${input.idempotencyKey}:provider`});
 await deps.repository.completeGuidebookRenewalSchedule({obligationId:claim.obligationId,providerSubscriptionReference:scheduled.subscriptionId,providerTrialEnd:scheduled.trialEndsAt.toISOString()});
 return Object.freeze({...claim,status:"scheduled" as const,providerSubscriptionReference:scheduled.subscriptionId});
}

export async function beginApprovedFurnishingCheckout(deps:Readonly<{repository:Oc001SpecialPurchaseRepository;provider:Oc001SpecialCommerceProvider;environment:CommerceEnvironment}>,input:Readonly<{actorId:string;approvalId:string;expectedRevision:number;providerCustomerId:string;baseUrl:string;idempotencyKey:string;idempotencyHash:string;correlationId:string}>){
 const intent=await deps.repository.createFurnishingPurchaseIntent({actorId:input.actorId,approvalId:input.approvalId,expectedRevision:input.expectedRevision,environment:deps.environment,idempotencyHash:input.idempotencyHash,correlationId:input.correlationId});
 const session=await deps.provider.createAuthoritativeAmountCheckout({customerId:input.providerCustomerId,productId:intent.providerProductReference,name:"Furnishing Design Plan — approved scope",amountMinor:intent.amountMinor,currency:"USD",successUrl:`${input.baseUrl}/checkout/success?purchase=${encodeURIComponent(intent.purchaseIntentId)}&session_id={CHECKOUT_SESSION_ID}`,cancelUrl:`${input.baseUrl}/checkout/cancel?purchase=${encodeURIComponent(intent.purchaseIntentId)}`,metadata:{purchase_intent_id:intent.purchaseIntentId,scope_approval_id:input.approvalId,configuration_checksum:intent.configurationChecksum,offer_code:"FS-DESIGN"},idempotencyKey:`${input.idempotencyKey}:provider`});
 const attemptId=crypto.randomUUID();await deps.repository.attachCheckout({actorId:input.actorId,purchaseIntentId:intent.purchaseIntentId,attemptId,sessionReference:session.id,customerReference:input.providerCustomerId,expiresAt:session.expiresAt.toISOString(),idempotencyHash:input.idempotencyHash,correlationId:input.correlationId});
 return Object.freeze({purchaseIntentId:intent.purchaseIntentId,attemptId,redirectUrl:session.url,amountMinor:intent.amountMinor});
}
