import Link from "next/link";
import type {
  MetricValueState,
  PortfolioMetric,
  PortfolioMetricSummary,
  PortfolioOverview,
} from "../application/overview";
import { SupportingSignalsDrawer } from "./supporting-signals-drawer";

export function PortfolioOverviewView({ overview }: { overview: PortfolioOverview }) {
  if (overview.scope.propertyCount === 0) return <PortfolioOverviewEmpty />;
  return (
    <main className="mx-auto max-w-[1500px] space-y-5 px-4 pb-8 pt-3 sm:px-6 lg:px-8">
      <h1 className="sr-only">Portfolio Overview</h1>
      {overview.permissionLimited ? <Notice title="Your Assigned Portfolio">This view includes only properties assigned to your role. Inaccessible property names and totals are not disclosed.</Notice> : null}
      {overview.scope.propertyCount === 1 ? <Notice title="Single-property portfolio">Portfolio totals are available. Comparative property and diversification analysis requires additional properties.</Notice> : null}
      {overview.freshness !== "current" ? <Notice title="Portfolio data may be incomplete">{overview.evidence.limitingSource ? `${overview.evidence.limitingSource} is the limiting data source.` : "One or more operational sources are not current."} Last known values remain labeled by freshness.</Notice> : null}
      <PortfolioMetrics metrics={overview.metrics} />
      <PortfolioConditionView overview={overview} />
      <PortfolioChanges overview={overview} />
      <div className="grid gap-8 xl:grid-cols-2">
        <PortfolioContribution overview={overview} />
        <PortfolioAttention overview={overview} />
      </div>
      <div className="grid gap-8 xl:grid-cols-2">
        <PortfolioComposition overview={overview} />
        <PortfolioExecution overview={overview} />
      </div>
      <PortfolioEvidenceFreshness overview={overview} />
    </main>
  );
}

export function PortfolioOverviewHeader({ overview }: { overview: PortfolioOverview }) {
  return <header className="rounded-[2rem] bg-[#101416] p-6 text-white sm:p-8">
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">Understand · Portfolio Intelligence</p>
    <div className="mt-3 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
      <div><h1 className="text-3xl font-semibold sm:text-4xl">Portfolio Overview</h1><p className="mt-3 text-lg text-stone-200">{overview.scopeLabel}</p><p className="mt-1 text-sm text-stone-400">{overview.scope.propertyCount} included {overview.scope.propertyCount === 1 ? "property" : "properties"} · {dateRange(overview.period.current)}</p></div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
        <Fact label="Comparison" value={overview.comparisonAvailable ? comparisonLabel(overview.period.comparisonType) : "Unavailable"} />
        <Fact label="Freshness" value={label(overview.freshness)} />
        <Fact label="Confidence" value={label(overview.confidence)} />
        <Fact label="Evaluated" value={evaluated(overview.evaluatedAt)} />
      </dl>
    </div>
  </header>;
}

function PortfolioConditionView({ overview }: { overview: PortfolioOverview }) {
  return <section aria-labelledby="condition-heading" className="grid gap-5 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-sm lg:grid-cols-[0.7fr_1.3fr] sm:p-8">
    <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Portfolio condition</p><h2 id="condition-heading" className="mt-3 text-3xl font-semibold text-stone-950">{condition(overview.condition.status)}</h2></div>
    <div><p className="text-lg leading-8 text-stone-800">{overview.condition.explanation}</p><dl className="mt-5 grid gap-4 sm:grid-cols-2"><Fact label="Primary driver" value={overview.condition.primaryDriver} /><Fact label="Primary limitation" value={overview.condition.primaryLimitation ?? "No material limitation"} /></dl>{overview.condition.destination ? <SupportingSignalsDrawer condition={overview.condition} metrics={overview.metrics}/> : null}</div>
  </section>;
}

function PortfolioMetrics({ metrics }: { metrics: readonly PortfolioMetricSummary[] }) {
  return <section aria-labelledby="metrics-heading"><SectionHeading id="metrics-heading" title="Current performance" description="A small set of weighted portfolio metrics, each carrying its own availability, confidence, and freshness." /><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{metrics.map((metric) => <article key={metric.metric} className="rounded-2xl border border-stone-200 bg-white p-5"><p className="text-sm font-semibold text-stone-600">{metricLabel(metric.metric)}</p><p className="mt-3 text-2xl font-semibold text-stone-950">{formatMetric(metric.metric, metric.current)}</p><p className="mt-2 min-h-10 text-xs leading-5 text-stone-600">{changeText(metric)}</p><div className="mt-4 flex flex-wrap gap-2"><Pill>{label(metric.availability)}</Pill><Pill>{label(metric.confidence)} confidence</Pill><Pill>{label(metric.freshness)}</Pill></div></article>)}</div></section>;
}

function PortfolioChanges({ overview }: { overview: PortfolioOverview }) {
  return <section id="changes" aria-labelledby="changes-heading"><SectionHeading id="changes-heading" title="What changed" description="Measured movement and scope changes only; mathematical contribution is not treated as inferred causation." />{overview.scopeChanged ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">Reported change includes a portfolio scope change and should not be read as pure operating performance.</p> : null}{overview.changes.length ? <ul className="mt-5 grid gap-4 md:grid-cols-2">{overview.changes.map((item) => <li key={item.id} className="rounded-2xl border border-stone-200 bg-white p-5"><Pill>{label(item.direction)}</Pill><h3 className="mt-3 font-semibold text-stone-950">{item.title}</h3><p className="mt-2 text-sm leading-6 text-stone-600">{item.description}</p><p className="mt-3 text-xs text-stone-500">{label(item.confidence)} confidence · {item.affectedPropertyIds.length} affected {item.affectedPropertyIds.length === 1 ? "property" : "properties"}</p></li>)}</ul> : <p className="mt-5 rounded-2xl bg-white p-5 text-sm text-stone-700">Portfolio performance was broadly stable during this period.</p>}</section>;
}

function PortfolioContribution({ overview }: { overview: PortfolioOverview }) {
  return <SectionCard id="contribution-heading" title="Property contribution" description="A concise preview of authorized properties driving the portfolio total.">{overview.propertyContribution.items.length ? <ul className="divide-y divide-stone-100">{overview.propertyContribution.items.map((item) => <li key={item.propertyId} className="py-4 first:pt-0"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold text-stone-950">{item.name}</h3><p className="mt-1 text-xs text-stone-500">{label(item.state)} · {label(item.confidence)} confidence</p></div><div className="text-right"><p className="font-semibold text-stone-950">{item.revenue === null ? "Revenue unavailable" : money(item.revenue)}</p><p className="mt-1 text-xs text-stone-500">{item.revenueShare === null ? "Share unavailable" : `${(item.revenueShare * 100).toFixed(1)}% of portfolio revenue`}</p><p className="text-xs text-stone-500">{item.revenueChange === null ? "Comparison unavailable" : `${signedMoney(item.revenueChange)} versus comparison`}</p></div></div></li>)}</ul> : <EmptyText>No property contribution is available.</EmptyText>}{overview.propertyContribution.destination ? <Link href={overview.propertyContribution.destination} className="mt-5 inline-flex text-sm font-semibold text-teal-800 underline-offset-4 hover:underline">View Property Comparison</Link> : null}</SectionCard>;
}

function PortfolioAttention({ overview }: { overview: PortfolioOverview }) {
  return <section id="attention" aria-labelledby="attention-heading" className="rounded-[2rem] border border-stone-200 bg-white p-6 sm:p-7"><SectionHeading id="attention-heading" title="Portfolio attention" description="Descriptive signals to inspect; these are not recommendations or risk classifications." />{overview.attention.length ? <ul className="mt-5 space-y-3">{overview.attention.map((item) => <li key={item.id} className="rounded-xl bg-stone-50 p-4"><h3 className="font-semibold text-stone-950">{item.title}</h3><p className="mt-1 text-sm text-stone-700">{item.description}</p><p className="mt-2 text-xs leading-5 text-stone-500">{item.impact} · {label(item.confidence)} confidence</p>{item.destination ? <Link className="mt-3 inline-flex text-sm font-semibold text-teal-800 underline-offset-4 hover:underline" href={item.destination}>Review {item.title}</Link> : null}</li>)}</ul> : <EmptyText>No material portfolio attention signals are established.</EmptyText>}</section>;
}

function PortfolioComposition({ overview }: { overview: PortfolioOverview }) {
  return <SectionCard id="composition-heading" title="Composition snapshot" description="Descriptive composition only; no concentration judgment is applied."><Dimension title="Markets" values={overview.composition.markets} /><Dimension title="Property types" values={overview.composition.propertyTypes} /><Dimension title="Operating models" values={overview.composition.operatingModels} />{overview.composition.destination ? <Link href={overview.composition.destination} className="mt-5 inline-flex text-sm font-semibold text-teal-800 underline-offset-4 hover:underline">View Portfolio Composition</Link> : null}</SectionCard>;
}
function PortfolioExecution({ overview }: { overview: PortfolioOverview }) {
  return <SectionCard id="execution-heading" title="Active decisions & actions" description="Canonical execution records only; this page does not create new decisions or actions."><dl className="grid grid-cols-3 gap-3"><Fact label="Active decisions" value={String(overview.execution.activeDecisions)} /><Fact label="Open actions" value={String(overview.execution.openActions)} /><Fact label="Reviews due" value={String(overview.execution.outcomeReviewsDue)} /></dl>{overview.execution.items.length ? <ul className="mt-5 space-y-3">{overview.execution.items.map((item) => <li key={item.id}><Link href={item.destination} className="block rounded-xl bg-stone-50 p-4 font-semibold text-stone-900 outline-none focus-visible:ring-2 focus-visible:ring-teal-600">{item.title}<span className="mt-1 block text-xs font-normal text-stone-500">{label(item.kind)} · {label(item.status)}</span></Link></li>)}</ul> : <EmptyText>No active portfolio decisions or actions.</EmptyText>}</SectionCard>;
}

function PortfolioEvidenceFreshness({ overview }: { overview: PortfolioOverview }) {
  const dimensions = [["Property coverage", overview.evidence.propertyCoverage],["Booking coverage",overview.evidence.bookingCoverage],["Revenue coverage",overview.evidence.revenueCoverage],["Financial coverage",overview.evidence.financialCoverage],["Operational coverage",overview.evidence.operationalCoverage],["Market coverage",overview.evidence.marketCoverage]] as const;
  return <section aria-labelledby="evidence-heading" className="rounded-[2rem] border border-stone-200 bg-white p-6 sm:p-8"><SectionHeading id="evidence-heading" title="Evidence & freshness" description="Reliability limitations are part of the analysis, not hidden in a technical footer." /><div className="mt-6 grid gap-6 lg:grid-cols-[1fr_2fr]"><div><p className="text-3xl font-semibold text-stone-950">{label(overview.confidence)}</p><p className="mt-1 text-sm text-stone-600">Overall portfolio confidence</p><p className="mt-4 text-sm text-stone-700">Data freshness: <strong>{label(overview.freshness)}</strong></p>{overview.evidence.limitingSource ? <p className="mt-2 text-sm text-amber-800">Limiting source: {overview.evidence.limitingSource}</p> : null}</div><dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">{dimensions.map(([name, coverage]) => <Fact key={name} label={name} value={`${Math.round(coverage * 100)}%`} />)}<Fact label="History length" value={overview.evidence.historyLengthDays === null ? "Unavailable" : `${overview.evidence.historyLengthDays} days`} /></dl></div></section>;
}

export function PortfolioOverviewEmpty() {
  return <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6"><section role="status" className="rounded-[2rem] border border-stone-200 bg-white p-8 text-center"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Portfolio Intelligence</p><h1 className="mt-3 text-3xl font-semibold text-stone-950">No portfolio is available</h1><p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-stone-600">Include or connect at least one property to begin portfolio analysis.</p><Link href="/dashboard/workspace/properties" className="mt-6 inline-flex rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white">Review workspace properties</Link></section></main>;
}
export function PortfolioOverviewError({ message = "Your workspace remains available. No portfolio data was changed." }: { message?: string }) {
  return <main className="mx-auto max-w-3xl px-4 py-16"><section role="alert" aria-live="assertive" className="rounded-[2rem] border border-rose-200 bg-white p-8"><h1 className="text-3xl font-semibold text-stone-950">Portfolio Intelligence could not be loaded</h1><p className="mt-3 text-sm text-stone-600">{message}</p></section></main>;
}
export function PortfolioOverviewSkeleton() {
  return <main aria-hidden="true" className="mx-auto max-w-[1500px] animate-pulse space-y-7 px-4 py-8 motion-reduce:animate-none sm:px-6 lg:px-8"><span className="sr-only">Loading Portfolio Overview</span><div className="h-64 rounded-[2rem] bg-stone-200" /><div className="h-48 rounded-[2rem] bg-stone-200" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <div className="h-36 rounded-2xl bg-stone-200" key={index} />)}</div><div className="h-56 rounded-[2rem] bg-stone-200" /><div className="grid gap-8 xl:grid-cols-2"><div className="h-80 rounded-[2rem] bg-stone-200" /><div className="h-80 rounded-[2rem] bg-stone-200" /></div></main>;
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) { return <aside role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950"><strong>{title}.</strong> {children}</aside>; }
function SectionCard({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) { return <section aria-labelledby={id} className="rounded-[2rem] border border-stone-200 bg-white p-6 sm:p-7"><SectionHeading id={id} title={title} description={description} /><div className="mt-5">{children}</div></section>; }
function SectionHeading({ id, title, description }: { id: string; title: string; description: string }) { return <div><h2 id={id} className="text-2xl font-semibold tracking-tight text-stone-950">{title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-stone-600">{description}</p></div>; }
function Fact({ label: title, value }: { label: string; value: string }) { return <div><dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-stone-500">{title}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>; }
function Pill({ children }: { children: React.ReactNode }) { return <span className="inline-flex rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-semibold text-stone-700">{children}</span>; }
function EmptyText({ children }: { children: React.ReactNode }) { return <p className="mt-5 rounded-xl bg-stone-50 p-4 text-sm text-stone-600">{children}</p>; }
function Dimension({ title, values }: { title: string; values: readonly { label: string; propertyCount: number; share: number }[] }) { return <div className="border-b border-stone-100 py-4 last:border-0"><h3 className="text-sm font-semibold text-stone-600">{title}</h3><ul className="mt-2 space-y-2">{values.slice(0,3).map((item) => <li className="flex justify-between gap-4 text-sm" key={item.label}><span>{item.label}</span><span className="font-semibold">{item.propertyCount} · {Math.round(item.share * 100)}%</span></li>)}</ul></div>; }
function formatMetric(metric: PortfolioMetric, state: MetricValueState) { if (state.state === "unavailable") return "Unavailable"; if (metric === "gross-revenue" || metric === "adr" || metric === "revpar" || metric === "noi" || metric === "cash-flow") return money(state.value); if (metric === "occupancy" || metric === "operating-margin") return `${(state.value * 100).toFixed(1)}%`; return new Intl.NumberFormat("en-US").format(state.value); }
function changeText(metric: PortfolioMetricSummary) { if (!metric.change) return metric.comparison ? "Comparison unavailable — insufficient reliable prior data." : "No comparison selected."; const value = metric.change.unit === "percentage-points" ? `${Math.abs(metric.change.absolute * 100).toFixed(1)} percentage points` : metric.change.percentage === null ? `${Math.abs(metric.change.absolute).toFixed(1)}` : `${Math.abs(metric.change.percentage * 100).toFixed(1)}%`; return `${metric.change.absolute >= 0 ? "Increased" : "Decreased"} ${value} ${metric.comparisonLabel}.`; }
function metricLabel(metric: PortfolioMetric) { const labels: Record<PortfolioMetric,string> = { "gross-revenue":"Gross Revenue", occupancy:"Occupancy", adr:"ADR", revpar:"RevPAR", bookings:"Booking Volume", noi:"NOI", "operating-margin":"Operating Margin", "cash-flow":"Cash Flow" }; return labels[metric]; }
function condition(value: PortfolioOverview["condition"]["status"]) { return { strong:"Strong",stable:"Stable","attention-needed":"Attention Needed","at-risk":"At Risk","insufficient-evidence":"Insufficient Evidence" }[value]; }
function label(value: string) { return value.replaceAll("-", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function money(value: number) { return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value); }
function signedMoney(value: number) { return `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`; }
function dateRange(range: { from: string; to: string }) { const format = (value: string) => new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(new Date(`${value}T00:00:00Z`)); return `${format(range.from)}–${format(range.to)}`; }
function comparisonLabel(value: string) { return value === "previous-year" ? "Previous year" : value === "previous-period" ? "Previous period" : "No comparison"; }
function evaluated(value: string) { return new Intl.DateTimeFormat("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date(value)); }
