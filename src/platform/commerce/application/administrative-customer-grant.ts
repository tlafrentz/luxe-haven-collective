import { CAPABILITY_REGISTRY, type CapabilityCode, type ProductFamilyCode } from "../domain/commercial-catalog";

export class AdministrativeCustomerGrantError extends Error{constructor(public code:string){super(code)}}
export interface AdministrativeCustomerGrantAuthorization{authorize(actorId:string):Promise<boolean>}
export interface AdministrativeCustomerGrantRepository{find(subjectId:string,grantCode:string):Promise<{tenantId:string;customerAccountId:string;entitlementIds:readonly string[]}|null>;provision(input:{actorId:string;subjectId:string;productFamilies:readonly ProductFamilyCode[];capabilityCodes:readonly CapabilityCode[];grantCode:string;effectiveUntil:string;reasonCode:string;correlationId:string}):Promise<{tenantId:string;customerAccountId:string;entitlementIds:readonly string[]}>}

export class ProvisionAdministrativeCustomerGrant{
 constructor(private authorization:AdministrativeCustomerGrantAuthorization,private repository:AdministrativeCustomerGrantRepository){}
 async execute(input:{actorId:string;subjectId:string;productFamilies:readonly ProductFamilyCode[];grantCode:string;effectiveUntil:Date;reasonCode:string;correlationId:string}){
  if(!await this.authorization.authorize(input.actorId))throw new AdministrativeCustomerGrantError("ADMINISTRATIVE_GRANT_NOT_AUTHORIZED");
  if(input.effectiveUntil<=new Date()||!input.productFamilies.length)throw new AdministrativeCustomerGrantError("ADMINISTRATIVE_GRANT_INVALID");
  const existing=await this.repository.find(input.subjectId,input.grantCode);if(existing)return existing;
  const families=[...new Set(input.productFamilies)],capabilityCodes=(Object.values(CAPABILITY_REGISTRY).filter(value=>families.includes(value.productFamily)).map(value=>value.code));
  return this.repository.provision({actorId:input.actorId,subjectId:input.subjectId,productFamilies:families,capabilityCodes,grantCode:input.grantCode,effectiveUntil:input.effectiveUntil.toISOString(),reasonCode:input.reasonCode,correlationId:input.correlationId});
 }
}
