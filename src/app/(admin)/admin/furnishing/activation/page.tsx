import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import ActivationControls from "./activation-controls";

export default async function FurnishingActivationAdminPage(){
 await requireRole(["admin"]);const db=await createClient();
 const[{data:release},{data:capabilities},{data:workspaces},{data:audit}]=await Promise.all([
  db.from("furnishing_activation_releases").select("*").eq("milestone","FS-008A").order("updated_at",{ascending:false}).limit(1).maybeSingle(),
  db.from("furnishing_activation_capabilities").select("capability,enabled,optimistic_version").order("capability"),
  db.from("furnishing_activation_workspaces").select("id,workspace_id,enabled,kill_switch,cohort,expires_at,revoked_at,optimistic_version").order("created_at"),
  db.from("furnishing_activation_audit_events").select("event_type,reason_code,actor_role,occurred_at").order("occurred_at",{ascending:false}).limit(20),
 ]);
 const required=["catalog_viewing","design_workspace","budgeting","procurement_readiness"].map(name=>capabilities?.find(x=>x.capability===name)??{capability:name,enabled:false,optimistic_version:0});
 return <main className="mx-auto max-w-6xl space-y-8 px-5 py-10"><header><p className="eyebrow">Furnishing controls</p><h1 className="mt-2 text-4xl font-semibold">FS-008A activation readiness</h1><p className="mt-3 text-stone-600">Internal-only ceiling: public activation, FS-FULL, retailer ordering, notifications, payments, and installation effects remain unavailable.</p></header><section className="grid gap-4 sm:grid-cols-3"><Card label="Release state" value={release?.global_state??"disabled"}/><Card label="Kill switch" value={release?.global_kill_switch===false?"lifted":"engaged"}/><Card label="Policy" value={release?.policy_version??"fs008a-v1"}/></section><ActivationControls release={release} capabilities={required} workspaces={workspaces??[]}/><section className="rounded-2xl border p-6"><h2 className="text-2xl font-semibold">Immutable control history</h2><div className="mt-4 space-y-2">{(audit??[]).map(event=><div className="flex flex-wrap justify-between gap-2 border-b py-2 text-sm" key={`${event.event_type}-${event.occurred_at}`}><span>{event.event_type} · {event.reason_code}</span><span>{event.occurred_at}</span></div>)}</div></section></main>
}
function Card({label,value}:{label:string;value:string}){return<div className="rounded-2xl border p-5"><p className="text-sm text-stone-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>}
