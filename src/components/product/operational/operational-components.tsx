import { AlertTriangle, ArrowDownToLine, Building2, CalendarCheck, Clock3, RefreshCw } from "lucide-react";
import Link from "next/link";

import type { OperationalActivity, OperationalPropertySummary } from "@/features/operational-surfaces";
import type { OperationalDataQualityStatus, SynchronizationHealth } from "@/platform/operational-data-quality";

export type OperationalContextValue = Readonly<{ workspaceId: string; workspaceLabel: string; propertyId?: string; startDate?: string; endDate?: string }>;

export function OperationalContextBar({ value, properties, action }: Readonly<{ value: OperationalContextValue; properties: readonly Readonly<{ id: string; label: string }>[]; action: string }>) {
  return (
    <form action={action} method="get" aria-label="Operational context" className="mt-6 grid gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_160px_160px_auto]">
      <label><span className="mb-1 block text-xs font-semibold text-stone-500">Workspace</span><select disabled aria-label="Workspace" className="min-h-11 w-full rounded-xl border border-stone-300 bg-stone-50 px-3 text-sm font-semibold text-stone-700 disabled:opacity-100"><option>{value.workspaceLabel}</option></select></label>
      <label><span className="mb-1 block text-xs font-semibold text-stone-500">Property</span><select name="property" defaultValue={value.propertyId ?? ""} className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-600"><option value="">All properties</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.label}</option>)}</select></label>
      <DateField name="start" label="Start date" value={value.startDate} />
      <DateField name="end" label="End date" value={value.endDate} />
      <button className="min-h-11 self-end rounded-full bg-stone-950 px-5 text-sm font-semibold text-white hover:bg-stone-800">Apply</button>
    </form>
  );
}

function DateField({ name, label, value }: Readonly<{ name: string; label: string; value?: string }>) {
  return <label><span className="mb-1 block text-xs font-semibold text-stone-500">{label}</span><input type="date" name={name} defaultValue={value} className="min-h-11 w-full rounded-xl border border-stone-300 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-600" /></label>;
}

export function OperationalHealthSummary({ arrivals, inStay, departures, issues, synchronization }: Readonly<{ arrivals: number; inStay: number; departures: number; issues: number; synchronization: SynchronizationHealth }>) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric icon={ArrowDownToLine} label="Arrivals today" value={arrivals} /><Metric icon={Building2} label="Guests in stay" value={inStay} /><Metric icon={CalendarCheck} label="Departures today" value={departures} /><Metric icon={AlertTriangle} label="Open issues" value={issues} /><Metric icon={RefreshCw} label="Synchronization" value={syncLabel(synchronization.status)} detail={synchronization.lastSuccessfulAt ? formatTimestamp(synchronization.lastSuccessfulAt) : "No successful synchronization"} /></div>;
}

function Metric({ icon: Icon, label, value, detail }: Readonly<{ icon: typeof Building2; label: string; value: string | number; detail?: string }>) {
  return <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><Icon aria-hidden="true" className="h-4 w-4 text-stone-500" /><p className="mt-4 text-2xl font-semibold tabular-nums text-stone-950">{value}</p><p className="mt-1 text-xs font-semibold text-stone-600">{label}</p>{detail ? <p className="mt-2 text-[11px] text-stone-400">{detail}</p> : null}</article>;
}

export function OperationalQualityIndicator({ status }: Readonly<{ status: OperationalDataQualityStatus }>) {
  const critical = ["degraded", "unusable"].includes(status);
  const label = qualityLabel(status);
  return <span aria-label={`Operational data quality: ${label}`} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${critical ? "bg-rose-50 text-rose-800" : status === "trusted" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${critical ? "bg-rose-600" : status === "trusted" ? "bg-emerald-600" : "bg-amber-600"}`} />{label}</span>;
}

export function OperationalActivityTimeline({ activities }: Readonly<{ activities: readonly OperationalActivity[] }>) {
  return <ol className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">{activities.map((activity) => <li key={activity.id} className="grid gap-3 border-b border-stone-200 p-5 last:border-b-0 sm:grid-cols-[auto_1fr_auto] sm:items-center"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-100"><Clock3 aria-hidden="true" className="h-4 w-4 text-stone-600" /></span><div><p className="text-sm font-semibold text-stone-950">{activity.title}</p><p className="mt-1 text-xs text-stone-500">{activity.description}</p></div><time dateTime={activity.occurredAt} className="text-xs text-stone-400">{formatTimestamp(activity.occurredAt)}</time></li>)}</ol>;
}

export function OperationalPropertyCard({ summary }: Readonly<{ summary: OperationalPropertySummary }>) {
  return <article className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{summary.property.marketLabel ?? "Hospitality property"}</p><h2 className="mt-2 text-lg font-semibold text-stone-950">{summary.property.name}</h2></div><OperationalQualityIndicator status={summary.quality.status} /></div><dl className="mt-6 grid grid-cols-3 gap-3 border-y border-stone-200 py-4 text-center"><PropertyMetric label="Arrivals" value={summary.upcomingArrivals} /><PropertyMetric label="In stay" value={summary.currentGuests} /><PropertyMetric label="Departures" value={summary.upcomingDepartures} /></dl><div className="mt-5 space-y-2 text-xs text-stone-500"><p>Status: <strong className="text-stone-800">{summary.property.status}</strong></p><p>Connection: <strong className="text-stone-800">{summary.property.connectionState}</strong></p><p>Last synchronized: <strong className="text-stone-800">{summary.property.lastSynchronizedAt ? formatTimestamp(summary.property.lastSynchronizedAt) : "Never"}</strong></p></div><Link href={`/properties?property=${encodeURIComponent(summary.property.id)}`} className="mt-5 inline-flex text-sm font-semibold text-teal-800 hover:underline">View operational detail</Link></article>;
}

function PropertyMetric({ label, value }: Readonly<{ label: string; value: number }>) {
  return <div><dt className="text-[11px] text-stone-500">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-stone-950">{value}</dd></div>;
}

export function OperationalDegradedState({ synchronization }: Readonly<{ synchronization: SynchronizationHealth }>) {
  if (synchronization.status === "succeeded" && !synchronization.recommendedAction) return null;
  const title = synchronization.status === "never-run" ? "No operational data has been synchronized" : synchronization.status === "partially-succeeded" ? "Operational data is partially available" : "Operational data may be outdated";
  return <section role="status" className="mt-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center"><AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0 text-amber-800" /><div className="flex-1"><h2 className="font-semibold text-amber-950">{title}</h2><p className="mt-1 text-sm text-amber-900">{synchronization.recommendedAction ?? "Last-known-good records remain available while the connection recovers."}</p></div><Link href="/dashboard/settings?section=connections" className="text-sm font-semibold text-amber-950 underline underline-offset-4">Review connected systems</Link></section>;
}

function qualityLabel(status: OperationalDataQualityStatus) {
  return { trusted: "Trusted", "usable-with-gaps": "Usable with Gaps", "attention-needed": "Attention Needed", degraded: "Degraded", unusable: "Unusable", unknown: "Unknown" }[status];
}

function syncLabel(status: SynchronizationHealth["status"]) {
  return { succeeded: "Current", "partially-succeeded": "Partial", failed: "Failed", skipped: "Skipped", "in-progress": "Syncing", "never-run": "Not connected" }[status];
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
