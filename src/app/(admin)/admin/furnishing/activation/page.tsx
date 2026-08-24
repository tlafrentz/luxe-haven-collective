import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";
import ActivationControls from "./activation-controls";

export default async function FurnishingActivationAdminPage() {
  await requireRole(["admin"]);
  const db = await createClient();
  const [{ data: release }, { data: capabilities }, { data: audit }] = await Promise.all([
    db.from("furnishing_activation_releases").select("*").eq("milestone", "FS-008A").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("furnishing_activation_capabilities").select("capability,enabled,optimistic_version").order("capability"),
    db.from("furnishing_activation_audit_events").select("event_type,reason_code,actor_role,occurred_at").order("occurred_at", { ascending: false }).limit(20),
  ]);
  return <main className="mx-auto max-w-6xl space-y-8 px-5 py-10"><header><p className="eyebrow">Furnishing controls</p><h1 className="mt-2 text-4xl font-semibold">FS-008A activation readiness</h1><p className="mt-3 text-stone-600">Safe ceiling: public activation, checkout, entitlements, projects, publication, notifications, installation transitions, and retailer ordering are disabled.</p></header><section className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border p-5"><p className="text-sm text-stone-500">Release state</p><p className="mt-2 text-2xl font-semibold">{release?.global_state ?? "disabled"}</p></div><div className="rounded-2xl border p-5"><p className="text-sm text-stone-500">Kill switch</p><p className="mt-2 text-2xl font-semibold">{release?.global_kill_switch === false ? "restored" : "enabled"}</p></div><div className="rounded-2xl border p-5"><p className="text-sm text-stone-500">Policy</p><p className="mt-2 text-2xl font-semibold">{release?.policy_version ?? "fs008a-v1"}</p></div></section><ActivationControls release={release} capabilities={capabilities ?? []} /><section className="rounded-2xl border p-6"><h2 className="text-2xl font-semibold">Immutable control history</h2><div className="mt-4 space-y-2">{(audit ?? []).map((event) => <div className="flex justify-between border-b py-2 text-sm" key={`${event.event_type}-${event.occurred_at}`}><span>{event.event_type} · {event.reason_code}</span><span>{event.occurred_at}</span></div>)}</div></section></main>;
}
