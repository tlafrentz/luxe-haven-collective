"use client";

import type { MarketAnalysisReport } from "@/features/market-intelligence";
import { AcquisitionType } from "../domain";
import { useInvestmentWorkspaceState } from "./investment-workspace-state";
import { ComparableExplorer as StrComparableExplorer } from "./comparable-explorer";
import { EvidenceExplorer } from "./evidence-explorer";
import { calculateSnapshotFreshness } from "../application";

export function InvestmentMarketEvidencePanel() {
  const { values, stage, propertyResolution, propertyAlternatives, marketReport, investmentAnalysisContext, strMarketContext } = useInvestmentWorkspaceState();
  const isLoading = stage === "resolving-property" || stage === "running-market-analysis";
  if (strMarketContext?.snapshot) {
    const snapshot = strMarketContext.snapshot, freshness = calculateSnapshotFreshness(snapshot);
    return <section className="space-y-5 rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">STR Market Intelligence</p>
        <h2 className="mt-2 text-2xl font-semibold">Evidence-backed underwriting</h2><p className="mt-2 text-sm text-neutral-600">Snapshot {snapshot.id} · Retrieved {new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(snapshot.createdAt))}</p></div>
        <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold">{freshness} · {snapshot.confidence.level} confidence</span></header>
      {freshness === "stale" ? <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">This evidence is stale. You can retain it, refresh into a new immutable snapshot, or continue manually.</p> : null}
      <details className="rounded-2xl border border-neutral-200 p-5"><summary className="cursor-pointer font-semibold">Open Comparable Explorer</summary><div className="mt-6"><StrComparableExplorer snapshot={snapshot} /></div></details>
      <details className="rounded-2xl border border-neutral-200 p-5"><summary className="cursor-pointer font-semibold">Open Evidence Explorer</summary><div className="mt-6"><EvidenceExplorer context={strMarketContext} /></div></details>
    </section>;
  }
  if (propertyAlternatives.length > 0) {
    return <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">Ambiguous property</p><h2 className="mt-2 text-xl font-semibold text-amber-950">Refine the address to select one subject.</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{propertyAlternatives.map(({ property }) => <article key={property.providerReferences.map(({ externalId }) => externalId).join(":")} className="rounded-xl border border-amber-200 bg-white p-4"><p className="font-semibold text-neutral-950">{property.address.formatted}</p><p className="mt-1 text-xs text-neutral-600">{property.characteristics.propertyType ?? "Property type unavailable"} · {property.characteristics.bedrooms ?? "?"} bd · {property.characteristics.bathrooms ?? "?"} ba · {property.characteristics.squareFeet?.toLocaleString() ?? "?"} sq ft</p></article>)}</div></section>;
  }
  if (!propertyResolution && !marketReport && !isLoading) {
    return (
      <section className="rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Market Intelligence</p>
        <h2 className="mt-2 text-xl font-semibold text-neutral-950">Real Market evidence will appear here.</h2>
        <p className="mt-2 text-sm leading-6 text-neutral-600">Enter a complete address and run the analysis. No synthetic property, valuation, rent estimate, or comparable evidence is shown.</p>
      </section>
    );
  }
  if (isLoading) {
    return <section aria-live="polite" className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"><p className="text-sm font-semibold text-neutral-950">Resolving the property and building canonical Market analysis…</p><p className="mt-2 text-xs text-neutral-500">Provider access runs securely on the server.</p></section>;
  }
  if (!marketReport || propertyResolution?.status !== "resolved") return null;
  const rentDifference = values.acquisitionType === AcquisitionType.RentalArbitrage && marketReport.longTermRent?.estimatedMonthlyRent !== undefined
    ? values.monthlyLease - marketReport.longTermRent.estimatedMonthlyRent
    : undefined;
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Market evidence</p><h2 className="mt-2 text-2xl font-semibold text-neutral-950">{propertyResolution.property.address.formatted}</h2><p className="mt-2 text-sm text-neutral-600">Canonical property and STR evidence supplied through Luxe Haven Market Intelligence.</p></div>
        <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700">{marketReport.confidence.level} confidence · {marketReport.confidence.score}/100</span>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <EvidenceCard title="Estimated market value" value={money(marketReport.saleValuation?.estimatedValue)} range={range(marketReport.saleValuation?.valueRange)} status={marketReport.saleValuation?.status ?? "not requested"} count={marketReport.saleValuation?.qualification.included.length ?? 0} />
        <EvidenceCard title="Estimated long-term rent" value={money(marketReport.longTermRent?.estimatedMonthlyRent, "/ month")} range={range(marketReport.longTermRent?.rentRange)} status={marketReport.longTermRent?.status ?? "not requested"} count={marketReport.longTermRent?.qualification.included.length ?? 0} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <ConfidencePanel report={marketReport} />
        <ComparableExplorer report={marketReport} />
      </div>
      {rentDifference !== undefined ? <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950">Proposed lease is {money(Math.abs(rentDifference))} {rentDifference >= 0 ? "above" : "below"} the Market estimate. This is a benchmark comparison, not a recommendation.</p> : null}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div><h3 className="text-sm font-semibold text-neutral-950">Limitations</h3><ul className="mt-2 space-y-1 text-xs leading-5 text-neutral-600">{marketReport.risks.slice(0, 4).map((risk) => <li key={risk.code}>• {risk.title}</li>)}{marketReport.dataGaps.slice(0, 4).map((gap) => <li key={gap.id}>• {gap.description}</li>)}{marketReport.risks.length + marketReport.dataGaps.length === 0 ? <li>No material Market limitations were identified.</li> : null}</ul></div>
        <div><h3 className="text-sm font-semibold text-neutral-950">How this analysis was built</h3><p className="mt-2 text-xs leading-5 text-neutral-600">Property resolved → provider evidence collected → comparables qualified → Market estimates projected → Investment assumptions assembled.</p><p className="mt-2 text-xs text-neutral-500">Policy {marketReport.lineage.policyVersion} · {marketReport.analyzedAt.toLocaleString()}</p><p className="mt-1 text-xs text-neutral-500">Market-sourced assumptions: {investmentAnalysisContext?.assumptions.filter(({ source }) => source === "market").map(({ key }) => key).join(", ") || "context only"}</p></div>
      </div>
    </section>
  );
}

function EvidenceCard({ title, value, range: valueRange, status, count }: { title: string; value: string; range: string; status: string; count: number }) {
  return <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5"><p className="text-xs font-medium text-neutral-500">{title}</p><p className="mt-2 text-2xl font-semibold text-neutral-950">{value}</p><p className="mt-1 text-xs text-neutral-500">{valueRange}</p><div className="mt-4 flex justify-between text-xs text-neutral-600"><span>{status}</span><span>{count} qualified comparables</span></div><p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Source: Market Intelligence</p></article>;
}

function ConfidencePanel({ report }: { report: MarketAnalysisReport }) {
  const dimensions = [
    ["Coverage", report.confidence.dimensions.coverage, "Comparable sample size and supported estimate coverage."],
    ["Similarity", report.confidence.dimensions.similarity, "Property, distance, capacity, recency, and physical match."],
    ["Agreement", report.confidence.dimensions.dispersion, "Consistency of weighted comparable values; wider dispersion lowers trust."],
  ] as const;
  const providers = providerEvidence(report);
  return <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Explainable confidence</p>
    <h3 className="mt-2 text-lg font-semibold text-neutral-950">{report.confidence.score}/100 · {report.confidence.level}</h3>
    <div className="mt-5 space-y-4">{dimensions.map(([name, score, explanation]) => <div key={name}>
      <div className="flex justify-between text-xs font-semibold text-neutral-700"><span>{name}</span><span>{score.toFixed(1)} points</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${Math.min(100, score / (name === "Similarity" ? 45 : name === "Coverage" ? 30 : 25) * 100)}%` }} /></div>
      <p className="mt-1.5 text-[11px] leading-4 text-neutral-500">{explanation}</p>
    </div>)}</div>
    {report.confidence.reasons.length ? <ul className="mt-4 space-y-1 border-t border-neutral-200 pt-4 text-xs text-amber-800">{report.confidence.reasons.map(reason => <li key={reason}>• {reason}</li>)}</ul> : null}
    <div className="mt-4 border-t border-neutral-200 pt-4"><p className="text-xs font-semibold text-neutral-800">Provider evidence</p><ul className="mt-2 space-y-1 text-xs text-neutral-600">{providers.map(item => <li key={item}>• {item}</li>)}</ul></div>
  </article>;
}

function ComparableExplorer({ report }: { report: MarketAnalysisReport }) {
  const sections = [
    ["Sale valuation", report.saleValuation?.qualification],
    ["Long-term rent", report.longTermRent?.qualification],
  ] as const;
  return <article className="rounded-2xl border border-neutral-200 bg-white p-5">
    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">Comparable explorer</p>
    <h3 className="mt-2 text-lg font-semibold text-neutral-950">Why these properties were selected</h3>
    <div className="mt-4 space-y-4">{sections.map(([title, qualification]) => qualification ? <details key={title} open className="rounded-xl border border-neutral-200">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-neutral-900">{title} · {qualification.included.length} included · {qualification.excluded.length} excluded</summary>
      <div className="border-t border-neutral-200 px-4 py-3">
        <div className="space-y-3">{qualification.included.slice(0, 5).map(item => <div key={item.candidate.id} className="grid gap-2 border-b border-neutral-100 pb-3 last:border-0 last:pb-0 sm:grid-cols-[1fr_auto]">
          <div><p className="text-sm font-semibold text-neutral-900">{item.candidate.address.formatted}</p><p className="mt-1 text-xs text-neutral-500">{item.candidate.distanceMiles?.toFixed(1) ?? "?"} mi · {item.candidate.bedrooms ?? "?"} bd · {item.candidate.bathrooms ?? "?"} ba · {item.candidate.squareFeet?.toLocaleString() ?? "?"} sq ft</p><p className="mt-1 text-[11px] leading-4 text-neutral-500">{item.similarity.rationale.join(" ")} {item.outlier.rationale.join(" ")}</p></div>
          <div className="text-left sm:text-right"><p className="text-sm font-semibold text-neutral-900">{item.similarity.score.toFixed(0)}% similar</p><p className="text-xs text-neutral-500">{(item.normalizedWeight * 100).toFixed(1)}% projection weight</p><p className="mt-1 text-[11px] font-semibold uppercase text-emerald-700">{providerNames(item.candidate.provenance.map(value => value.provider))}</p></div>
        </div>)}</div>
        {qualification.excluded.length ? <p className="mt-3 text-xs text-neutral-500">{qualification.excluded.length} excluded comparable{qualification.excluded.length === 1 ? "" : "s"} remain in the snapshot with exclusion reasons; outliers are never silently discarded.</p> : null}
      </div>
    </details> : null)}</div>
  </article>;
}

function providerEvidence(report: MarketAnalysisReport): string[] {
  const candidates = [report.saleValuation, report.longTermRent].flatMap(section => section?.qualification.included.map(item => item.candidate) ?? []);
  const groups = new Map<string, Date[]>();
  for (const candidate of candidates) for (const provenance of candidate.provenance) {
    const name = String(provenance.provider);
    groups.set(name, [...(groups.get(name) ?? []), ...(provenance.retrievedAt ? [provenance.retrievedAt] : [])]);
  }
  if (!groups.size) return ["No provider-backed comparable evidence was available."];
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([provider, dates]) => {
    const latest = dates.sort((a, b) => b.getTime() - a.getTime())[0];
    return `${provider} · ${candidates.filter(candidate => candidate.provenance.some(value => String(value.provider) === provider)).length} comparable records${latest ? ` · refreshed ${latest.toLocaleDateString()}` : " · freshness unavailable"}`;
  });
}

function providerNames(values: readonly unknown[]): string {
  return [...new Set(values.map(String))].sort().join(" + ") || "Provider unavailable";
}

function money(value: number | undefined, suffix = ""): string { return value === undefined ? "Unavailable" : `$${Math.round(value).toLocaleString("en-US")}${suffix}`; }
function range(value: Readonly<{ lower: number; upper: number }> | undefined): string { return value ? `${money(value.lower)}–${money(value.upper)}` : "No supported range"; }
