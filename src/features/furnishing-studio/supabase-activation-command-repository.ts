import type { SupabaseClient } from "@supabase/supabase-js";
import { FurnishingActivationCommandError, type FurnishingActivationCommandRepository, type FurnishingControlRecord, type FurnishingCommandResult } from "./admin-activation-commands";

type Resolution = Readonly<{ status?: string; target?: string; targetId?: string; state?: string; version?: number; tenantId?: string }>;

function mapped(error: Readonly<{ message?: string }> | null | undefined): FurnishingActivationCommandError | Error {
 const message=error?.message??"";
 if(message.includes("FURNISHING_ACTIVATION_NOT_FOUND"))return new FurnishingActivationCommandError("NOT_FOUND","The activation target was not found.");
 if(message.includes("FURNISHING_ACTIVATION_FORBIDDEN")||message.includes("FURNISHING_ACTIVATION_ADMIN_REQUIRED"))return new FurnishingActivationCommandError("FORBIDDEN","The activation target is outside the authorized controlled scope.");
 if(message.includes("FURNISHING_ACTIVATION_VERSION_CONFLICT"))return new FurnishingActivationCommandError("VERSION_CONFLICT","The activation control changed; reload and retry.");
 if(message.includes("FURNISHING_ACTIVATION_IDEMPOTENCY_CONFLICT"))return new FurnishingActivationCommandError("IDEMPOTENCY_CONFLICT","The idempotency key was reused with different input.");
 if(message.includes("FURNISHING_ACTIVATION_SEQUENCE_REQUIRED"))return new FurnishingActivationCommandError("SEQUENCE_REQUIRED","Complete the preceding activation steps shown on this page before retrying this control.");
 return new Error("ACTIVATION_REPOSITORY_UNAVAILABLE");
}

/** Production adapter: state and audit commit through one authenticated RPC. */
export function createSupabaseFurnishingActivationRepository(client:SupabaseClient):FurnishingActivationCommandRepository{return{
 async read(target,targetId,tenantId){
  const{data,error}=await client.rpc("resolve_furnishing_activation_control",{p_target:target,p_target_id:targetId,p_tenant_id:tenantId??null});
  if(error)throw mapped(error);
  const value=data as Resolution|null;
  if(!value||value.status==="not_found")throw new FurnishingActivationCommandError("NOT_FOUND","The activation target was not found.");
  if(value.status==="forbidden")throw new FurnishingActivationCommandError("FORBIDDEN","The activation target is outside the authorized controlled scope.");
  if(value.status!=="found"||typeof value.targetId!=="string"||typeof value.version!=="number")throw new Error("ACTIVATION_REPOSITORY_UNAVAILABLE");
  return{target,targetId:value.targetId,state:String(value.state) as FurnishingControlRecord["state"],version:value.version,...(value.tenantId?{tenantId:value.tenantId}:{})};
 },
 async findIdempotency(key){const{data}=await client.from("furnishing_activation_audit_events").select("safe_metadata").eq("idempotency_key",key).maybeSingle();const value=data?.safe_metadata;if(!value||typeof value!=="object")return null;const x=value as Record<string,unknown>;return typeof x.fingerprint==="string"&&x.result&&typeof x.result==="object"?{fingerprint:x.fingerprint,result:x.result as FurnishingCommandResult}:null},
 async commit(input){const{error}=await client.rpc("apply_furnishing_activation_control_c2",{p_before:input.before,p_after:input.after,p_audit:input.audit,p_fingerprint:input.fingerprint});if(error)throw mapped(error)}
}}
