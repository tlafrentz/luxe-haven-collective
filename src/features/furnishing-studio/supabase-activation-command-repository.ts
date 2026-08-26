import type { SupabaseClient } from "@supabase/supabase-js";
import type { FurnishingActivationCommandRepository, FurnishingControlRecord, FurnishingCommandResult } from "./admin-activation-commands";

/** Production adapter: state and audit commit through one authenticated RPC. */
export function createSupabaseFurnishingActivationRepository(client:SupabaseClient):FurnishingActivationCommandRepository{return{
 async read(target,targetId){
  if(target==="global"){const{data}=await client.from("furnishing_activation_releases").select("*").eq("id",targetId).maybeSingle();return data?record(target,targetId,data):null}
  if(target==="capability"){const{data}=await client.from("furnishing_activation_capabilities").select("*").eq("capability",targetId).maybeSingle();return data?record(target,targetId,data):{target,targetId,state:"disabled",version:0}}
  const{data}=await client.from("furnishing_activation_workspaces").select("*").eq("workspace_id",targetId).maybeSingle();
  if(data)return record(target,targetId,data);
  const{data:workspace}=await client.from("workspace_memberships").select("workspace_id").eq("workspace_id",targetId).limit(1).maybeSingle();
  return workspace?{target,targetId,state:"disabled",version:0,tenantId:targetId}:null;
 },
 async tenantOwnsTarget(target,targetId,tenantId){if(target==="global")return true;if(target==="capability"){if(!tenantId)return false;const{data}=await client.from("furnishing_activation_workspaces").select("id").eq("workspace_id",tenantId).is("revoked_at",null).maybeSingle();return Boolean(data)}return tenantId===targetId},
 async findIdempotency(key){const{data}=await client.from("furnishing_activation_audit_events").select("safe_metadata").eq("idempotency_key",key).maybeSingle();const value=data?.safe_metadata;if(!value||typeof value!=="object")return null;const x=value as Record<string,unknown>;return typeof x.fingerprint==="string"&&x.result&&typeof x.result==="object"?{fingerprint:x.fingerprint,result:x.result as FurnishingCommandResult}:null},
 async commit(input){const{error}=await client.rpc("apply_furnishing_activation_control",{p_before:input.before,p_after:input.after,p_audit:input.audit,p_fingerprint:input.fingerprint});if(error)throw new Error("ACTIVATION_REPOSITORY_UNAVAILABLE")}
}}
function record(target:FurnishingControlRecord["target"],targetId:string,data:Record<string,unknown>):FurnishingControlRecord{return{target,targetId,state:String(data.global_state??(data.enabled?"internal":"disabled")) as FurnishingControlRecord["state"],version:Number(data.optimistic_version??1),...(data.workspace_id?{tenantId:String(data.workspace_id)}:{})}}
