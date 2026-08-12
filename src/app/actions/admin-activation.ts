"use server";
import"server-only";
import{createHash}from"node:crypto";
import{requireRole}from"@/lib/auth/session";
import{createAdminClient}from"@/lib/supabase/admin";
import{createActivationCoordinationPorts,ExecuteAdminActivationAction,SupabaseAdminActivationAuthorization,SupabaseAdminActivationProjectionReader,SupabaseAdminActivationRepository,type AdminActivationOperationInput,type AdminActivationOperationPort}from"@/platform/admin-activation";
import{createProductionFirstValue}from"@/platform/first-value";
import{createProductionOnboarding}from"@/platform/onboarding";

export async function listAdminActivationCases(){const{user}=await requireRole(["admin"]);return new SupabaseAdminActivationProjectionReader(createAdminClient()).list(user.id)}

function authoritativePorts(actorId:string):Record<string,AdminActivationOperationPort>{
 const firstValue=createProductionFirstValue(actorId),onboarding=createProductionOnboarding();
 const journey=(value:AdminActivationOperationInput)=>{if(!value.journeyId)throw new Error("JOURNEY_REQUIRED");return value.journeyId};
 const moduleTarget=(value:AdminActivationOperationInput)=>{if(!value.onboardingCaseId||!value.moduleInstanceId||value.expectedRevision===undefined)throw new Error("MODULE_REQUIRED");return value};
 return{
  "first_value.processing.retry":{execute:async value=>{const id=journey(value),result=await firstValue.process.execute({actorId:value.actorId,journeyId:id,correlationId:value.correlationId});return{referenceId:id,status:result.status}}},
  "first_value.evaluate":{execute:async value=>{const id=journey(value),result=await firstValue.evaluate.execute({actorId:value.actorId,journeyId:id,expectedRevision:value.expectedRevision,correlationId:value.correlationId});return{referenceId:id,status:result.code}}},
  "first_value.destination.open":{execute:async value=>{const id=journey(value),result=await firstValue.evaluate.execute({actorId:value.actorId,journeyId:id,correlationId:value.correlationId});if(!result.achieved||!value.productFamily)throw new Error("DESTINATION_UNAUTHORIZED");return{referenceId:id,status:"authorized",destination:{hpm:"/dashboard/hpm",guidebook:"/dashboard/guidebooks",furnishing:"/dashboard/furnishing/projects",investment_intelligence:"/dashboard/investments"}[value.productFamily]}}},
  "onboarding.request_changes":{execute:async raw=>{const value=moduleTarget(raw),result=await onboarding.verify.execute({actorId:value.actorId,tenantId:value.tenantId,onboardingCaseId:value.onboardingCaseId!,moduleInstanceId:value.moduleInstanceId!,outcome:"changes_requested",reasonCode:value.reason,customerSafeMessage:value.customerSafeMessage,expectedRevision:value.expectedRevision!,correlationId:value.correlationId});return{referenceId:result.module.id,status:result.module.status}}},
  "onboarding.internal_review.complete":{execute:async raw=>{const value=moduleTarget(raw),result=await onboarding.verify.execute({actorId:value.actorId,tenantId:value.tenantId,onboardingCaseId:value.onboardingCaseId!,moduleInstanceId:value.moduleInstanceId!,outcome:"verified",reasonCode:value.reason,expectedRevision:value.expectedRevision!,correlationId:value.correlationId});return{referenceId:result.module.id,status:result.module.status}}},
 };
}

export async function executeRegisteredActivationOperation(input:{tenantId:string;customerAccountId:string;actionCode:string;productFamily?:"hpm"|"guidebook"|"furnishing"|"investment_intelligence";journeyId?:string;onboardingCaseId?:string;moduleInstanceId?:string;sourceStatus:string;expectedRevision?:number;reason?:string;assignedOperatorId?:string;noteBody?:string;guidanceCode?:string;customerSafeMessage?:string;correlationId:string;idempotencyKey?:string}){const{user}=await requireRole(["admin"]),client=createAdminClient(),repository=new SupabaseAdminActivationRepository(client,user.id),ports:Record<string,AdminActivationOperationPort>={...createActivationCoordinationPorts(repository),...authoritativePorts(user.id)};const operation=new ExecuteAdminActivationAction({authorization:new SupabaseAdminActivationAuthorization(client),repository,ports,hashIdempotency:async value=>createHash("sha256").update(value).digest("hex")});return operation.execute({actorId:user.id,roleCode:"admin",...input})}
