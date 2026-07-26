import type { CommerceOrderLine, FulfillmentType } from "../domain";

export type EntitlementScopeType = "workspace"|"profile"|"property"|"opportunity"|"order";
export type EntitlementGrantType = "capability"|"credit"|"download"|"quota"|"discount";
export type EntitlementDurationPolicy = "perpetual"|"subscription-period"|"fixed-duration"|"single-use"|"until-revoked";
export type EntitlementGrantStatus = "pending"|"active"|"suspended"|"expired"|"revoked"|"consumed";
export type FulfillmentStatus = "pending"|"processing"|"ready"|"in-progress"|"completed"|"failed"|"cancelled";

export type CommerceEntitlementTemplate = Readonly<{
  id:string;key:string;name:string;description:string;scopeType:EntitlementScopeType;grantType:EntitlementGrantType;
  durationPolicy:EntitlementDurationPolicy;defaultDurationDays?:number;defaultQuantity?:number;
  status:"draft"|"active"|"inactive"|"archived";metadata:Readonly<Record<string,string>>;
}>;
export type CommerceProductEntitlementRule = Readonly<{
  id:string;version:number;productId?:string;offerId?:string;entitlementTemplateId:string;quantity?:number;durationDays?:number;
  activationTrigger:"order-paid"|"subscription-active"|"subscription-renewed"|"manual";
  cancellationBehavior:"retain"|"expire-at-period-end"|"suspend-immediately"|"no-effect";
  refundBehavior:"retain"|"suspend"|"revoke"|"manual-review";
}>;
export type CommerceEntitlementGrant = Readonly<{
  id:string;entitlementTemplateId:string;entitlementKey:string;scopeType:EntitlementScopeType;
  workspaceId?:string;profileId?:string;propertyId?:string;opportunityId?:string;orderId?:string;
  sourceType:"subscription"|"order"|"promotion"|"manual"|"founding-partner";sourceId:string;
  quantity?:number;remainingQuantity?:number;status:EntitlementGrantStatus;effectiveFrom:Date;effectiveUntil?:Date;
  revision:number;createdAt:Date;updatedAt:Date;
}>;
export type ResolvedEntitlement = Readonly<{key:string;status:"available"|"unavailable"|"suspended"|"expired";quantity?:number;remainingQuantity?:number;effectiveUntil?:Date;sources:readonly string[]}>;
export type ResolvedEntitlementSet = Readonly<{entitlements:readonly ResolvedEntitlement[];version:string;evaluatedAt:Date}>;
export type CommerceFulfillmentPlanLine = Readonly<{orderLineId:string;fulfillmentType:FulfillmentType;adapterKey:string;entitlementTemplateIds:readonly string[];idempotencyKey:string;productSnapshot:CommerceOrderLine["productSnapshot"]}>;
export type CommerceFulfillmentPlan = Readonly<{orderId:string;lines:readonly CommerceFulfillmentPlanLine[];version:string}>;
export type CommerceFulfillmentResult = Readonly<{targetType:string;targetId:string;status:"ready"|"in-progress"|"completed";nextAction?:string}>;
export interface CommerceFulfillmentAdapter {
  readonly key:string;
  fulfill(input:Readonly<{idempotencyKey:string;workspaceId?:string;profileId:string;orderId:string;orderLineId:string;propertyId?:string;opportunityId?:string;configuration:Readonly<Record<string,string>>}>):Promise<CommerceFulfillmentResult>;
  findByIdempotencyKey?(key:string):Promise<CommerceFulfillmentResult|null>;
}

export class CommerceEntitlementError extends Error {
  constructor(public readonly code:string,message:string){super(message);Object.freeze(this)}
}
export function validateEntitlementTemplate(template:CommerceEntitlementTemplate):CommerceEntitlementTemplate{
  if(!/^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$/.test(template.key))throw new CommerceEntitlementError("commerce_entitlement_key_invalid","Entitlement keys must be stable and namespaced.");
  if(template.grantType==="credit"&&(!template.defaultQuantity||template.defaultQuantity<1))throw new CommerceEntitlementError("commerce_entitlement_quantity_exceeded","Credit templates require a positive default quantity.");
  if(template.durationPolicy==="fixed-duration"&&(!template.defaultDurationDays||template.defaultDurationDays<1))throw new CommerceEntitlementError("commerce_entitlement_expired","Fixed-duration templates require a duration.");
  return deepFreeze({...template,metadata:{...template.metadata}});
}
export function resolveEntitlements(input:Readonly<{grants:readonly CommerceEntitlementGrant[];requestedKeys?:readonly string[];workspaceId?:string;profileId:string;propertyId?:string;opportunityId?:string;evaluatedAt?:Date}>):ResolvedEntitlementSet{
 const now=input.evaluatedAt??new Date(),keys=input.requestedKeys??[...new Set(input.grants.map(g=>g.entitlementKey))],entitlements=keys.map(key=>{
  const scoped=input.grants.filter(g=>g.entitlementKey===key&&scopeMatches(g,input));
  const valid=scoped.filter(g=>g.status==="active"&&g.effectiveFrom<=now&&(!g.effectiveUntil||g.effectiveUntil>now)&&(g.remainingQuantity===undefined||g.remainingQuantity>0));
  const suspended=scoped.some(g=>g.status==="suspended"),expired=scoped.some(g=>g.status==="expired"||(g.effectiveUntil!==undefined&&g.effectiveUntil<=now));
  if(!valid.length)return deepFreeze({key,status:suspended?"suspended":expired?"expired":"unavailable",sources:[]}) as ResolvedEntitlement;
  const finite=valid.filter(g=>g.remainingQuantity!==undefined),remaining=finite.length?finite.reduce((sum,g)=>sum+(g.remainingQuantity??0),0):undefined;
  const ends=valid.flatMap(g=>g.effectiveUntil?[g.effectiveUntil]:[]);
  return deepFreeze({key,status:"available"as const,...(remaining!==undefined?{quantity:finite.reduce((sum,g)=>sum+(g.quantity??0),0),remainingQuantity:remaining}:{}),...(ends.length?{effectiveUntil:new Date(Math.max(...ends.map(d=>d.getTime())))}:{}),sources:valid.map(g=>g.id)});
 });
 return deepFreeze({entitlements,version:stableVersion(input.grants,now),evaluatedAt:now});
}
export function hasEntitlement(input:Parameters<typeof resolveEntitlements>[0]&Readonly<{entitlementKey:string}>):boolean{return resolveEntitlements({...input,requestedKeys:[input.entitlementKey]}).entitlements[0]?.status==="available"}
export function reserveEntitlementCredit(grant:CommerceEntitlementGrant,quantity:number):CommerceEntitlementGrant{
 if(grant.status!=="active"||!Number.isInteger(quantity)||quantity<1||grant.remainingQuantity===undefined||grant.remainingQuantity<quantity)throw new CommerceEntitlementError("commerce_entitlement_quantity_exceeded","Insufficient entitlement credit.");
 return deepFreeze({...grant,remainingQuantity:grant.remainingQuantity-quantity,status:grant.remainingQuantity===quantity?"consumed":grant.status,revision:grant.revision+1,updatedAt:new Date()});
}
export function releaseEntitlementCredit(grant:CommerceEntitlementGrant,quantity:number):CommerceEntitlementGrant{
 if(!Number.isInteger(quantity)||quantity<1||grant.quantity===undefined||grant.remainingQuantity===undefined||grant.remainingQuantity+quantity>grant.quantity)throw new CommerceEntitlementError("commerce_entitlement_quantity_exceeded","Credit release exceeds the grant.");
 return deepFreeze({...grant,remainingQuantity:grant.remainingQuantity+quantity,status:"active"as const,revision:grant.revision+1,updatedAt:new Date()});
}
export function buildOrderFulfillmentPlan(orderId:string,lines:readonly CommerceOrderLine[]):CommerceFulfillmentPlan{
 return deepFreeze({orderId,lines:lines.map(line=>({orderLineId:line.id,fulfillmentType:line.productSnapshot.fulfillmentType,adapterKey:adapterKey(line.productSnapshot.fulfillmentType),entitlementTemplateIds:[...line.productSnapshot.entitlementTemplateIds],idempotencyKey:`fulfill:${orderId}:${line.id}:v${line.priceSnapshot.version}`,productSnapshot:line.productSnapshot})),version:`order-snapshot:${orderId}`});
}
export async function invokeCommerceFulfillmentAdapter(adapter:CommerceFulfillmentAdapter,input:Parameters<CommerceFulfillmentAdapter["fulfill"]>[0]){
 try{return await adapter.fulfill(input)}catch(error){const existing=adapter.findByIdempotencyKey?await adapter.findByIdempotencyKey(input.idempotencyKey):null;if(existing)return existing;throw new CommerceEntitlementError("commerce_fulfillment_failed",error instanceof Error?error.message:"Fulfillment adapter failed.")}
}
export function subscriptionGrantStatus(input:Readonly<{status:string;cancelAtPeriodEnd:boolean;periodEnd:Date;graceDays?:number;evaluatedAt?:Date}>):Readonly<{status:EntitlementGrantStatus;effectiveUntil:Date}>{
 const now=input.evaluatedAt??new Date(),graceDays=input.graceDays??7;
 if(input.status==="active"||input.status==="trialing"||input.cancelAtPeriodEnd)return deepFreeze({status:"active",effectiveUntil:input.periodEnd});
 if(input.status==="past-due"){const graceEnd=new Date(input.periodEnd.getTime()+graceDays*86400000);return deepFreeze({status:now<graceEnd?"active":"suspended",effectiveUntil:graceEnd})}
 if(input.status==="paused"||input.status==="unpaid")return deepFreeze({status:"suspended",effectiveUntil:input.periodEnd});
 return deepFreeze({status:"expired",effectiveUntil:input.periodEnd});
}
function adapterKey(type:FulfillmentType){return({"digital-download":"digital-download","entitlement-grant":"entitlement-grant","service-project":"guidebook-project","appointment":"notary-service-request","analysis-credit":"investment-analysis-credit","manual-fulfillment":"manual-service-order","no-fulfillment":"no-op"}as const)[type]}
function scopeMatches(grant:CommerceEntitlementGrant,input:{workspaceId?:string;profileId:string;propertyId?:string;opportunityId?:string}){
 if(grant.workspaceId&&grant.workspaceId!==input.workspaceId)return false;if(grant.profileId&&grant.profileId!==input.profileId)return false;
 if(grant.propertyId&&grant.propertyId!==input.propertyId)return false;if(grant.opportunityId&&grant.opportunityId!==input.opportunityId)return false;return true;
}
function stableVersion(grants:readonly CommerceEntitlementGrant[],now:Date){return `${Math.max(0,...grants.map(g=>g.revision))}:${Math.floor(now.getTime()/60000)}`}
function deepFreeze<T>(value:T):T{if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))deepFreeze(child)}return value}
