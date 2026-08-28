import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import ActivationControls from "./activation-controls";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type ResolutionStatus="unresolved"|"invalid"|"not_found"|"forbidden"|"found";

export default async function FurnishingActivationAdminPage({searchParams}:{searchParams:Promise<{workspaceId?:string}>}){
 await requireRole(["admin"]);const db=await createClient(),params=await searchParams,workspaceId=(params.workspaceId??"").trim().toLowerCase(),names=["catalog_viewing","design_workspace","budgeting","procurement_readiness"];
 const requestedStatus:ResolutionStatus=!workspaceId?"unresolved":!UUID.test(workspaceId)?"invalid":"found";
 const[{data:releaseResolution},{data:audit},workspaceResponse]=await Promise.all([
  db.rpc("resolve_furnishing_activation_control",{p_target:"global",p_target_id:"global",p_tenant_id:null}),
  db.from("furnishing_activation_audit_events").select("event_type,reason_code,actor_role,occurred_at").order("occurred_at",{ascending:false}).limit(20),
  requestedStatus==="found"?db.rpc("resolve_furnishing_activation_control",{p_target:"workspace",p_target_id:workspaceId,p_tenant_id:workspaceId}):Promise.resolve({data:null}),
 ]);
 const global=releaseResolution as null|{status?:string;targetId?:string;state?:string;version?:number;releaseStatus?:string;globalKillSwitch?:boolean;configurationValid?:boolean;policyVersion?:string},release=global?.status==="found"?{id:global.targetId,global_state:global.state,optimistic_version:Number(global.version),release_status:global.releaseStatus,global_kill_switch:global.globalKillSwitch,configuration_valid:global.configurationValid,policy_version:global.policyVersion}:null;
 const raw=workspaceResponse.data as null|{status?:string;version?:number;state?:string;killSwitch?:boolean;cohort?:string|null;expiresAt?:string|null;revokedAt?:string|null};
 const workspaceStatus:ResolutionStatus=requestedStatus!=="found"?requestedStatus:raw?.status==="found"?"found":raw?.status==="forbidden"?"forbidden":"not_found";
 const workspace=workspaceStatus==="found"&&raw?{id:workspaceId,workspace_id:workspaceId,enabled:raw.state==="internal",kill_switch:raw.killSwitch!==false,cohort:raw.cohort,expires_at:raw.expiresAt,revoked_at:raw.revokedAt,optimistic_version:Number(raw.version)}:null;
 const capabilityResponses=workspace?await Promise.all(names.map(name=>db.rpc("resolve_furnishing_activation_control",{p_target:"capability",p_target_id:name,p_tenant_id:workspaceId}))):[];
 const required=names.map((name,index)=>{const value=capabilityResponses[index]?.data as null|{status?:string;version?:number;state?:string};return{capability:name,enabled:value?.state==="internal",optimistic_version:value?.status==="found"&&typeof value.version==="number"?value.version:null}});
 return <main className="mx-auto max-w-6xl space-y-8 px-5 py-10"><header><p className="eyebrow">Furnishing controls</p><h1 className="mt-2 text-4xl font-semibold">FS-008A activation readiness</h1><p className="mt-3 text-stone-600">Internal-only ceiling: public activation, FS-FULL, retailer ordering, notifications, payments, and installation effects remain unavailable.</p></header><section className="grid gap-4 sm:grid-cols-3"><Card label="Release state" value={release?.global_state??"disabled"}/><Card label="Kill switch" value={release?.global_kill_switch===false?"lifted":"engaged"}/><Card label="Policy" value={release?.policy_version??"fs008a-v1"}/></section><ActivationControls release={release} capabilities={required} workspace={workspace} workspaceId={workspaceId} workspaceStatus={workspaceStatus}/><section className="rounded-2xl border p-6"><h2 className="text-2xl font-semibold">Immutable control history</h2><div className="mt-4 space-y-2">{(audit??[]).map(event=><div className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm" key={`${event.event_type}-${event.occurred_at}`}><span>{event.event_type} · {event.reason_code}</span><span>{event.occurred_at}</span></div>)}</div></section></main>
}
function Card({label,value}:{label:string;value:string}){return<div className="rounded-2xl border p-5"><p className="text-sm text-stone-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>}
