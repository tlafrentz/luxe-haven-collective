import Link from "next/link";
import {
  getCommerceHealth,
  queueCommerceReconciliation,
  refreshCommerceAlerts,
} from "@/app/actions/commerce-operations";

const statusStyle = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-900",
  degraded: "border-amber-200 bg-amber-50 text-amber-950",
  critical: "border-red-200 bg-red-50 text-red-950",
  unavailable: "border-stone-200 bg-stone-50 text-stone-700",
};

export default async function CommerceHealthPage() {
  const view = await getCommerceHealth();
  return (
    <main className="mx-auto max-w-7xl space-y-8 px-5 py-10">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="eyebrow">Commerce operations</p>
          <h1 className="mt-2 text-4xl font-semibold">Commerce health</h1>
          <p className="mt-3 max-w-3xl text-stone-600">
            Provider-neutral payment, subscription, webhook, fulfillment, configuration, and recovery health.
          </p>
        </div>
        <form action={refreshCommerceAlerts}>
          <button className="rounded-full border px-4 py-2 font-semibold" type="submit">Refresh operational alerts</button>
        </form>
      </header>

      {view.dataState === "partial" ? (
        <p role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          Commerce health is partially available. One or more operational sources could not be evaluated.
        </p>
      ) : null}

      <section aria-labelledby="health-metrics">
        <h2 id="health-metrics" className="text-2xl font-semibold">Operational indicators</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {view.health.metrics.map((metric) => (
            <article className={`rounded-2xl border p-5 ${statusStyle[metric.status]}`} key={metric.key}>
              <p className="text-sm font-semibold">{metric.label}</p>
              <p className="mt-2 text-3xl font-semibold">
                {metric.value === undefined ? "Unavailable" : metric.unit === "percent" ? `${metric.value.toFixed(1)}%` : metric.value}
              </p>
              <p className="mt-3 text-sm">{metric.explanation}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide">{metric.status}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border p-6">
          <h2 className="text-2xl font-semibold">Processing latency</h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-2">
            <div><dt className="text-sm text-stone-600">Average webhook processing</dt><dd className="mt-1 text-2xl font-semibold">{formatDuration(view.latency.webhookMilliseconds)}</dd></div>
            <div><dt className="text-sm text-stone-600">Average fulfillment handoff</dt><dd className="mt-1 text-2xl font-semibold">{formatDuration(view.latency.fulfillmentMilliseconds)}</dd></div>
          </dl>
        </article>
        <article className="rounded-2xl border p-6">
          <h2 className="text-2xl font-semibold">Production configuration</h2>
          <ul className="mt-4 space-y-3">
            {view.configuration.map((item) => (
              <li className="flex gap-3" key={item.key}>
                <span className="font-semibold uppercase">{item.status}</span>
                <span>{item.explanation}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-stone-600">Secret values are never returned to this view.</p>
        </article>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-semibold">Operational attention</h2>
          <nav className="flex gap-3 text-sm font-semibold" aria-label="Recovery queues">
            <Link href="/admin/commerce/webhooks">Webhook queue</Link>
            <Link href="/admin/commerce/fulfillment">Fulfillment queue</Link>
          </nav>
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50"><tr><th className="p-4">Severity</th><th className="p-4">Condition</th><th className="p-4">Subject</th><th className="p-4">Observed</th></tr></thead>
            <tbody>{view.alerts.map((alert) => (
              <tr className="border-t" key={alert.id}>
                <td className="p-4 font-semibold uppercase">{alert.severity}</td>
                <td className="p-4">{alert.summary}</td>
                <td className="p-4">{alert.subject_type}: {alert.subject_id}</td>
                <td className="p-4">{new Date(alert.last_observed_at).toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table>
          {!view.alerts.length ? <p className="p-8 text-center text-stone-600">No open Commerce operational alerts.</p> : null}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]">
        <div>
          <h2 className="text-2xl font-semibold">Reconciliation queue</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-50"><tr><th className="p-4">Subject</th><th className="p-4">Environment</th><th className="p-4">State</th><th className="p-4">Attempts</th></tr></thead>
              <tbody>{view.reconciliation.map((job) => (
                <tr className="border-t" key={job.id}>
                  <td className="p-4">{job.subject_type}: {job.subject_id}</td><td className="p-4">{job.environment}</td><td className="p-4">{job.status}</td><td className="p-4">{job.attempts}</td>
                </tr>
              ))}</tbody>
            </table>
            {!view.reconciliation.length ? <p className="p-8 text-center text-stone-600">No Commerce reconciliation work is queued.</p> : null}
          </div>
        </div>
        <form action={queueCommerceReconciliation} className="rounded-2xl border p-6">
          <h2 className="text-xl font-semibold">Request reconciliation</h2>
          <p className="mt-2 text-sm text-stone-600">This queues provider-state verification. It cannot set a record to Paid manually.</p>
          <label className="mt-4 block text-sm font-semibold">Environment<select className="mt-1 w-full rounded-xl border p-3" name="environment"><option value="test">Test</option><option value="live">Live</option></select></label>
          <label className="mt-4 block text-sm font-semibold">Subject type<select className="mt-1 w-full rounded-xl border p-3" name="subjectType">{["order","payment","customer","subscription","invoice","product","price","entitlement"].map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="mt-4 block text-sm font-semibold">Internal subject ID<input className="mt-1 w-full rounded-xl border p-3" name="subjectId" required /></label>
          <label className="mt-4 block text-sm font-semibold">Reason<textarea className="mt-1 min-h-24 w-full rounded-xl border p-3" minLength={8} name="reason" required /></label>
          <button className="mt-5 rounded-full bg-stone-950 px-5 py-2 font-semibold text-white" type="submit">Queue reconciliation</button>
        </form>
      </section>
    </main>
  );
}

function formatDuration(value: number | undefined) {
  if (value === undefined) return "Unavailable";
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(1)} sec`;
}
