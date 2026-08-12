import { CAPABILITY_REGISTRY, LIMIT_STRATEGIES, CommercialCatalogError, isCapabilityCode, type CapabilityCode, type LimitAllowance, type OfferDefinition, type OfferLimitCode } from "../domain/commercial-catalog";
import { effectiveStatus, entitlementScopeMatches, type Entitlement, type EntitlementAuditEvent, type EntitlementAuthorization, type EntitlementDecision, type EntitlementLimitResolver, type EntitlementRepository, type EntitlementStatus } from "../domain/ca001a-entitlement";

export interface EvaluateEntitlement { execute(input:Readonly<{actorId:string;tenantId:string;customerAccountId:string;capability:string;resource?:Readonly<{type:string;id:string}>;asOf:Date}>):Promise<EntitlementDecision>; }

export class AuthoritativeEntitlementEvaluator implements EvaluateEntitlement {
  constructor(private readonly repository:EntitlementRepository,private readonly authorization:EntitlementAuthorization,private readonly limits?:EntitlementLimitResolver){}
  async execute(input:Readonly<{actorId:string;tenantId:string;customerAccountId:string;capability:string;resource?:Readonly<{type:string;id:string}>;asOf:Date}>):Promise<EntitlementDecision>{
    if(!isCapabilityCode(input.capability)) return {allowed:false,capability:input.capability as CapabilityCode,reason:"unknown_capability"};
    const capability=input.capability;
    if(!await this.authorization.authenticate(input.actorId))return{allowed:false,capability,reason:"not_authenticated"};
    if(!await this.authorization.isTenantMember(input.actorId,input.tenantId,input.customerAccountId))return{allowed:false,capability,reason:"not_authorized"};
    if(!await this.authorization.isResourceAuthorized(input.actorId,input.tenantId,input.resource))return{allowed:false,capability,reason:"not_authorized"};
    const candidates=(await this.repository.listForAccount(input.tenantId,input.customerAccountId)).filter(value=>value.tenantId===input.tenantId&&value.customerAccountId===input.customerAccountId&&value.capabilityCode===capability);
    if(!candidates.length)return{allowed:false,capability,reason:"not_entitled"};
    const scoped=candidates.filter(value=>entitlementScopeMatches(value.resourceScope,input.customerAccountId,input.resource));
    if(!scoped.length)return{allowed:false,capability,reason:"resource_out_of_scope"};
    const active=scoped.filter(value=>effectiveStatus(value,input.asOf)==="active").sort((a,b)=>a.id.localeCompare(b.id));
    if(!active.length){const statuses=scoped.map(value=>effectiveStatus(value,input.asOf));return{allowed:false,capability,reason:statusReason(statuses)};}
    const limit=await this.limits?.resolve({...input,capability,entitlements:active});
    if(limit?.enforcement==="hard"&&limit.allowance.kind==="finite"&&limit.usage>=limit.allowance.value)return{allowed:false,capability,reason:"limit_reached"};
    return{allowed:true,capability,entitlementId:active[0].id,source:active[0].source,...(limit?{effectiveLimit:limit}:{})};
  }
}

export type OfferSelectionContext = Readonly<{customerAccountId:string;customerType:OfferDefinition["customerType"];offerCode:string;offerVersion:number;activationChannel:OfferDefinition["acquisitionMode"];activeOffers:readonly Readonly<{code:string;version:number}>[]}>;
export function validateOfferSelection(offer:OfferDefinition|undefined,input:OfferSelectionContext):Readonly<{valid:true;offer:OfferDefinition}|{valid:false;reason:"offer_inactive"|"not_eligible"|"prerequisite_missing"|"offer_incompatible"|"channel_invalid"}> {
  if(!offer||offer.status!=="active")return{valid:false,reason:"offer_inactive"};
  if(offer.customerType!==input.customerType)return{valid:false,reason:"not_eligible"};
  if(offer.acquisitionMode!==input.activationChannel)return{valid:false,reason:"channel_invalid"};
  const held=new Set(input.activeOffers.map(value=>value.code));
  if(offer.prerequisiteOfferCodes.some(code=>!held.has(code)))return{valid:false,reason:"prerequisite_missing"};
  if(input.activeOffers.some(value=>value.code===offer.code&&value.version!==offer.version))return{valid:false,reason:"offer_incompatible"};
  const incompatible=input.activeOffers.some(value=>!offer.compatibleOfferCodes.includes(value.code)&&value.code!==offer.code&&offer.productFamily===offerFamily(value.code));
  return incompatible?{valid:false,reason:"offer_incompatible"}:{valid:true,offer};
}

export function projectOfferEntitlements(input:Readonly<{tenantId:string;customerAccountId:string;offer:OfferDefinition;source:Entitlement["source"];sourceReferenceId:string;resourceScope:Entitlement["resourceScope"];effectiveFrom:string;effectiveUntil?:string;idFactory?:(capability:CapabilityCode)=>string;now?:string}>):readonly Entitlement[]{
  const now=input.now??new Date().toISOString();
  if(input.offer.status!=="active")throw new CommercialCatalogError("offer_inactive","Only active offers can be projected.");
  return Object.freeze(input.offer.includedCapabilities.map(grant=>Object.freeze({id:input.idFactory?.(grant.capability)??crypto.randomUUID(),tenantId:input.tenantId,customerAccountId:input.customerAccountId,capabilityCode:grant.capability,resourceScope:input.resourceScope,source:input.source,sourceReferenceId:input.sourceReferenceId,offerCode:input.offer.code,offerVersion:input.offer.version,status:"pending"as const,effectiveFrom:input.effectiveFrom,...(input.effectiveUntil?{effectiveUntil:input.effectiveUntil}:{}),createdAt:now,updatedAt:now,revision:1})));
}

export async function activateOfferEntitlements(dependencies:Readonly<{repository:EntitlementRepository;authorization:EntitlementAuthorization}>,input:Readonly<{actorId:string;tenantId:string;customerAccountId:string;offer:OfferDefinition;source:Entitlement["source"];sourceReferenceId:string;resourceScope:Entitlement["resourceScope"];effectiveFrom:string;effectiveUntil?:string;idempotencyKey:string;reasonCode:string;now?:string}>):Promise<readonly Entitlement[]>{
  const existing=await dependencies.repository.findActivation(input.idempotencyKey);if(existing)return existing;
  if(!await dependencies.authorization.canManageEntitlements(input.actorId,input.tenantId))throw new CommercialCatalogError("entitlement_management_forbidden","Entitlement activation is restricted.");
  const pending=projectOfferEntitlements(input),active=pending.map(value=>Object.freeze({...value,status:"active"as const}));
  const audit=active.map(value=>auditEvent(value,undefined,"active",input));
  return dependencies.repository.activate(active,audit,input.idempotencyKey);
}

export async function transitionEntitlement(dependencies:Readonly<{repository:EntitlementRepository;authorization:EntitlementAuthorization}>,input:Readonly<{actorId:string;tenantId:string;entitlement:Entitlement;toStatus:Extract<EntitlementStatus,"suspended"|"active"|"revoked">;reasonCode:string;sourceReferenceId:string;idempotencyKey:string;occurredAt:string;permanentAdministrativeGrantApproved?:boolean}>):Promise<Entitlement>{
  if(input.entitlement.tenantId!==input.tenantId||!await dependencies.authorization.canManageEntitlements(input.actorId,input.tenantId))throw new CommercialCatalogError("entitlement_management_forbidden","Entitlement transitions are restricted.");
  if(input.entitlement.source==="administrative_grant"&&!input.entitlement.effectiveUntil&&!input.permanentAdministrativeGrantApproved)throw new CommercialCatalogError("administrative_grant_expiration_required","Manual grants require expiration or explicit permanent approval.");
  const allowed:Record<EntitlementStatus,readonly EntitlementStatus[]>={pending:["active","revoked"],active:["suspended","revoked"],suspended:["active","revoked"],expired:[],revoked:[]};
  if(!allowed[input.entitlement.status].includes(input.toStatus))throw new CommercialCatalogError("entitlement_transition_invalid","The entitlement transition is invalid.");
  const updated=Object.freeze({...input.entitlement,status:input.toStatus,updatedAt:input.occurredAt,revision:input.entitlement.revision+1});
  return dependencies.repository.transition(updated,auditEvent(updated,input.entitlement.status,input.toStatus,input));
}

export function composeLimit(code:OfferLimitCode,values:readonly Readonly<{allowance:LimitAllowance;specificity:number}>[]):LimitAllowance|undefined{
  if(!values.length)return undefined;if(values.some(value=>value.allowance.kind==="unlimited"))return{kind:"unlimited"};
  const finite=values.map(value=>({value:(value.allowance as {kind:"finite";value:number}).value,specificity:value.specificity})),strategy=LIMIT_STRATEGIES[code];
  if(strategy==="additive")return{kind:"finite",value:finite.reduce((sum,item)=>sum+item.value,0)};
  if(strategy==="most_specific")return{kind:"finite",value:[...finite].sort((a,b)=>b.specificity-a.specificity||b.value-a.value)[0].value};
  return{kind:"finite",value:Math.max(...finite.map(item=>item.value))};
}

function auditEvent(entitlement:Entitlement,fromStatus:EntitlementStatus|undefined,toStatus:EntitlementStatus,input:Readonly<{actorId:string;tenantId:string;reasonCode:string;sourceReferenceId:string;idempotencyKey:string;now?:string;occurredAt?:string}>):EntitlementAuditEvent{return Object.freeze({id:crypto.randomUUID(),tenantId:input.tenantId,entitlementId:entitlement.id,...(fromStatus?{fromStatus}:{}),toStatus,actorId:input.actorId,reasonCode:input.reasonCode,sourceReferenceId:input.sourceReferenceId,idempotencyKey:input.idempotencyKey,occurredAt:input.occurredAt??input.now??new Date().toISOString()});}
function statusReason(statuses:readonly EntitlementStatus[]):"entitlement_pending"|"entitlement_suspended"|"entitlement_expired"|"entitlement_revoked"|"not_entitled"{if(statuses.includes("suspended"))return"entitlement_suspended";if(statuses.includes("pending"))return"entitlement_pending";if(statuses.includes("expired"))return"entitlement_expired";if(statuses.includes("revoked"))return"entitlement_revoked";return"not_entitled";}
function offerFamily(code:string):string{return code.split(".")[0];}

export function assertKnownCapability(code:string):CapabilityCode{if(!CAPABILITY_REGISTRY[code as CapabilityCode])throw new CommercialCatalogError("unknown_capability","Unknown capabilities fail closed.");return code as CapabilityCode;}
