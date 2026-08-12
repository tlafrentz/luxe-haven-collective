import type { CapabilityCode, LimitAllowance, OfferLimitCode } from "./commercial-catalog";

export type CustomerAccount = Readonly<{ id:string; tenantId:string; accountType:"individual"|"organization"|"owner"|"investor"|"service_client"; status:"pending"|"active"|"suspended"|"closed" }>;
export type EntitlementResourceScope = Readonly<{type:"customer_account";customerAccountId:string}|{type:"workspace";workspaceId:string}|{type:"property";propertyId:string}|{type:"guidebook";guidebookId:string}|{type:"furnishing_project";projectId:string}>;
export type EntitlementStatus = "pending"|"active"|"suspended"|"expired"|"revoked";
export type EntitlementSource = "offer_activation"|"subscription"|"service_engagement"|"administrative_grant"|"migration";
export type Entitlement = Readonly<{ id:string; tenantId:string; customerAccountId:string; capabilityCode:CapabilityCode; resourceScope:EntitlementResourceScope; source:EntitlementSource; sourceReferenceId:string; offerCode?:string; offerVersion?:number; status:EntitlementStatus; effectiveFrom:string; effectiveUntil?:string; createdAt:string; updatedAt:string; revision:number }>;
export type EffectiveLimit = Readonly<{code:OfferLimitCode;allowance:LimitAllowance;period?:"lifetime"|"month"|"year";usage:number;enforcement:"hard"|"soft"}>;
export type EntitlementDenialReason = "unknown_capability"|"not_authenticated"|"not_authorized"|"not_entitled"|"entitlement_pending"|"entitlement_suspended"|"entitlement_expired"|"entitlement_revoked"|"resource_out_of_scope"|"limit_reached"|"offer_inactive";
export type EntitlementDecision = Readonly<{allowed:true;capability:CapabilityCode;entitlementId:string;source:EntitlementSource;effectiveLimit?:EffectiveLimit}|{allowed:false;capability:CapabilityCode;reason:EntitlementDenialReason}>;
export type EntitlementAuditEvent = Readonly<{id:string;tenantId:string;entitlementId:string;fromStatus?:EntitlementStatus;toStatus:EntitlementStatus;actorId:string;reasonCode:string;sourceReferenceId:string;idempotencyKey:string;occurredAt:string}>;

export interface EntitlementRepository { listForAccount(tenantId:string,customerAccountId:string):Promise<readonly Entitlement[]>; findActivation(idempotencyKey:string):Promise<readonly Entitlement[]|null>; activate(entitlements:readonly Entitlement[], auditEvents:readonly EntitlementAuditEvent[], idempotencyKey:string):Promise<readonly Entitlement[]>; transition(entitlement:Entitlement,event:EntitlementAuditEvent):Promise<Entitlement>; }
export interface EntitlementAuthorization { authenticate(actorId:string):Promise<boolean>; isTenantMember(actorId:string,tenantId:string,customerAccountId:string):Promise<boolean>; isResourceAuthorized(actorId:string,tenantId:string,resource?:Readonly<{type:string;id:string}>):Promise<boolean>; canManageEntitlements(actorId:string,tenantId:string):Promise<boolean>; }
export interface EntitlementLimitResolver { resolve(input:Readonly<{tenantId:string;customerAccountId:string;entitlements:readonly Entitlement[];capability:CapabilityCode;resource?:Readonly<{type:string;id:string}>;asOf:Date}>):Promise<EffectiveLimit|undefined>; }

export function entitlementScopeMatches(scope:EntitlementResourceScope,accountId:string,resource?:Readonly<{type:string;id:string}>):boolean {
  if (scope.type === "customer_account") return scope.customerAccountId === accountId;
  if (!resource) return false;
  const id = scope.type === "workspace" ? scope.workspaceId : scope.type === "property" ? scope.propertyId : scope.type === "guidebook" ? scope.guidebookId : scope.projectId;
  return scope.type === resource.type && id === resource.id;
}

export function effectiveStatus(entitlement:Entitlement,asOf:Date):EntitlementStatus {
  if (entitlement.status !== "active") return entitlement.status;
  const time=asOf.getTime();
  if (Date.parse(entitlement.effectiveFrom)>time) return "pending";
  if (entitlement.effectiveUntil && Date.parse(entitlement.effectiveUntil)<=time) return "expired";
  return "active";
}
