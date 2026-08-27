import { getAuthEmailOperations } from "@/app/actions/auth-email-operations";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PublicAuthControls } from "./public-auth-controls";

export default async function AuthEmailOperationsPage() {
  const state = await getAuthEmailOperations();
  const control = state.control as { mode: string; version: number; hourly_email_ceiling: number; resend_cooldown_seconds: number };
  return <main className="space-y-8 py-8">
    <AdminPageHeader title="Authentication email operations" description="Governed public Auth availability, delivery health, suppression, and provider signals." />
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Authentication email health">
      <Card label="Public Auth" value={control.mode.replaceAll("_", " ")} />
      <Card label="CAPTCHA" value={state.captchaConfigured ? "Configured" : "Unavailable — fail closed"} />
      <Card label="Hourly sends" value={`${state.sendsThisHour} / ${control.hourly_email_ceiling}`} />
      <Card label="Webhook" value={state.webhookConfigured && state.lastWebhook ? "Receiving" : state.webhookConfigured ? "Awaiting event" : "Unavailable"} />
      <Card label="Cooldown" value={`${control.resend_cooldown_seconds} seconds`} />
      <Card label="Suppressed recipients" value={String(state.suppressedCount)} />
      <Card label="Delivered (24h)" value={String(state.deliveryCounts.delivered ?? 0)} />
      <Card label="Failures (24h)" value={String((state.deliveryCounts.failed ?? 0)+(state.deliveryCounts.rejected ?? 0)+(state.deliveryCounts.bounced_hard ?? 0))} />
    </section>
    <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-semibold">Public Auth control</h2><div className="mt-5"><PublicAuthControls mode={control.mode} version={control.version}/></div></section>
    <section className="rounded-2xl border bg-white p-6"><h2 className="text-xl font-semibold">Open alerts</h2>{state.alerts.length ? <ul className="mt-4 space-y-2">{state.alerts.map((a: {alert_type:string;severity:string;last_seen_at:string;occurrence_count:number})=><li key={`${a.alert_type}-${a.last_seen_at}`} className="rounded-xl border p-3 text-sm"><strong>{a.severity}</strong> · {a.alert_type.replaceAll("_"," ")} · {a.occurrence_count} occurrence(s)</li>)}</ul>:<p className="mt-3 text-sm text-stone-600">No open authentication-email alerts.</p>}</section>
    <p className="text-xs text-stone-500">Delivery means provider delivery, not message open or authentication completion. Recipient linkage may be best-effort when Supabase SMTP omits application correlation.</p>
  </main>;
}

function Card({label,value}:{label:string;value:string}) { return <div className="rounded-2xl border bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p><p className="mt-2 text-xl font-semibold">{value}</p></div> }
