import type { InvestmentDecisionAnalysis } from "../domain";

const label = (value: string) => value.split("-").map((part) => part ? part[0].toUpperCase() + part.slice(1) : part).join(" ");
const dateTime = (value: Date) => new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(value);

export function InvestmentDecisionContext({ analysis }: { analysis: InvestmentDecisionAnalysis }) {
  const brief = buildDecisionBrief(analysis);
  return <div className="space-y-6">
    <section className="rounded-3xl border border-stone-200 bg-stone-50 p-6 sm:p-8" aria-labelledby="decision-context-title">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Canonical decision analysis</p>
          <h3 id="decision-context-title" className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">{label(analysis.recommendation.status)}</h3>
          <p className="mt-3 text-sm leading-6 text-stone-600">{analysis.recommendation.summary}</p>
        </div>
        <dl className="grid min-w-[280px] grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <Fact term="Analysis" value={analysis.status} />
          <Fact term="Evidence" value={`${analysis.evidence.supportingCount + analysis.evidence.marketEvidenceCount} items`} />
          <Fact term="Comparables" value={String(analysis.evidence.comparableCount)} />
          <Fact term="Freshness" value={analysis.freshness.status} />
        </dl>
      </div>
      {analysis.evidence.missing.length > 0 ? <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-950">Evidence limitations</p>
        <ul className="mt-2 space-y-1 text-sm text-amber-900">{analysis.evidence.missing.map((item) => <li key={item}>• {item}</li>)}</ul>
      </div> : null}
    </section>

    <section className="grid gap-4 lg:grid-cols-4" aria-label="Decision explanation">
      <BriefCard eyebrow="Evidence" title="Why this decision" items={brief.evidence} empty="No decision-supporting evidence was available." />
      <BriefCard eyebrow="Primary upside" title="What could work" items={brief.upside} empty="No material upside was identified." tone="positive" />
      <BriefCard eyebrow="Key risks" title="What could break" items={brief.risks} empty="No material modeled risks were identified." tone="warning" />
      <BriefCard eyebrow="Next actions" title="What to validate" items={brief.nextActions} empty="Preserve this analysis and continue standard diligence." tone="action" />
    </section>

    <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <article className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7" aria-labelledby="score-breakdown-title">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Transparent scoring</p>
        <h3 id="score-breakdown-title" className="mt-2 text-xl font-semibold text-stone-950">Investment score components</h3>
        <p className="mt-2 text-sm leading-6 text-stone-600">Overall score {analysis.score.overall}/100. Each component exposes its policy weight and source rationale.</p>
        <div className="mt-6 space-y-5">{analysis.score.components.map((component) => <div key={component.key}>
          <div className="flex items-center justify-between gap-4 text-sm"><span className="font-semibold text-stone-900">{component.label}</span><span className="tabular-nums text-stone-600">{component.score}/100 · {component.weight}% weight</span></div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-100" aria-hidden="true"><div className="h-full rounded-full bg-amber-600" style={{ width: `${component.score}%` }} /></div>
          <p className="mt-2 text-xs leading-5 text-stone-500">{component.explanation}</p>
        </div>)}</div>
      </article>

      <article className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-7" aria-labelledby="decision-timeline-title">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Calculation lineage</p>
        <h3 id="decision-timeline-title" className="mt-2 text-xl font-semibold text-stone-950">Decision timeline</h3>
        <ol className="mt-6 space-y-5 border-l border-stone-200 pl-5">{analysis.timeline.map((event) => <li key={event.id} className="relative">
          <span className="absolute -left-[1.55rem] top-1.5 h-2 w-2 rounded-full bg-amber-600" aria-hidden="true" />
          <h4 className="text-sm font-semibold text-stone-950">{event.title}</h4>
          <time className="mt-1 block text-xs text-stone-500" dateTime={event.occurredAt.toISOString()}>{dateTime(event.occurredAt)}</time>
          <p className="mt-2 text-sm leading-6 text-stone-600">{event.description}</p>
        </li>)}</ol>
        <p className="mt-6 break-all rounded-xl bg-stone-50 p-3 text-xs leading-5 text-stone-500">Run lineage: {analysis.identity.workspaceRunId}</p>
      </article>
    </section>
  </div>;
}

function Fact({ term, value }: { term: string; value: string }) {
  return <div><dt className="text-xs uppercase tracking-[0.12em] text-stone-500">{term}</dt><dd className="mt-1 font-semibold text-stone-900">{label(value)}</dd></div>;
}

function BriefCard({ eyebrow, title, items, empty, tone = "neutral" }: { eyebrow: string; title: string; items: readonly string[]; empty: string; tone?: "neutral" | "positive" | "warning" | "action" }) {
  const classes = tone === "positive" ? "border-emerald-200 bg-emerald-50/60"
    : tone === "warning" ? "border-amber-200 bg-amber-50/60"
      : tone === "action" ? "border-blue-200 bg-blue-50/60"
        : "border-stone-200 bg-white";
  return <article className={`rounded-3xl border p-5 ${classes}`}>
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{eyebrow}</p>
    <h3 className="mt-2 text-base font-semibold text-stone-950">{title}</h3>
    <ul className="mt-4 space-y-3 text-sm leading-5 text-stone-700">
      {(items.length ? items : [empty]).map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true" className="text-stone-400">•</span><span>{item}</span></li>)}
    </ul>
  </article>;
}

export function buildDecisionBrief(analysis: InvestmentDecisionAnalysis) {
  const decision = analysis.lifecycleResult.analysis;
  const evidence = decision.supportingEvidence.slice(0, 3).map((item) => `${item.title}: ${item.description}`);
  const upside = [
    ...decision.supportingEvidence.filter((item) => item.direction === "positive").slice(0, 2).map((item) => item.title),
    ...(decision.comparableAnalysis.projectedRevenueUpside.amount > 0
      ? [`Comparable-supported annual revenue upside of ${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(decision.comparableAnalysis.projectedRevenueUpside.amount)}.`]
      : []),
  ].slice(0, 3);
  const risks = decision.risks.slice(0, 3).map((risk) => `${risk.title} · ${label(risk.severity)} severity, ${risk.probability.value}% likelihood.${risk.mitigation ? ` Mitigation: ${risk.mitigation}` : ""}`);
  const nextActions = [
    ...decision.risks.slice(0, 2).map((risk) => risk.mitigation ?? `Validate ${risk.title.toLowerCase()} before commitment.`),
    ...(analysis.evidence.missing.length ? ["Resolve the identified evidence limitations and generate a new immutable analysis version."] : []),
    ...(analysis.recommendation.status === "strong-opportunity" || analysis.recommendation.status === "opportunity"
      ? ["Confirm financing, inspection, and regulatory diligence before making an offer."]
      : []),
  ].slice(0, 3);
  return Object.freeze({
    evidence: Object.freeze(evidence),
    upside: Object.freeze(upside),
    risks: Object.freeze(risks),
    nextActions: Object.freeze(nextActions),
  });
}
