"use client";

import { AcquisitionType } from "../domain";
import { useInvestmentWorkspaceState } from "./investment-workspace-state";

export function InvestmentMarketEvidencePanel() {
  const { values, stage, propertyResolution, propertyAlternatives, marketReport, investmentAnalysisContext } = useInvestmentWorkspaceState();
  const isLoading = stage === "resolving-property" || stage === "running-market-analysis";
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
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Market evidence</p><h2 className="mt-2 text-2xl font-semibold text-neutral-950">{propertyResolution.property.address.formatted}</h2><p className="mt-2 text-sm text-neutral-600">Market evidence supplied by RentCast through Luxe Haven Market Intelligence.</p></div>
        <span className="rounded-full bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700">{marketReport.confidence.level} confidence · {marketReport.confidence.score}/100</span>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <EvidenceCard title="Estimated market value" value={money(marketReport.saleValuation?.estimatedValue)} range={range(marketReport.saleValuation?.valueRange)} status={marketReport.saleValuation?.status ?? "not requested"} count={marketReport.saleValuation?.qualification.included.length ?? 0} />
        <EvidenceCard title="Estimated long-term rent" value={money(marketReport.longTermRent?.estimatedMonthlyRent, "/ month")} range={range(marketReport.longTermRent?.rentRange)} status={marketReport.longTermRent?.status ?? "not requested"} count={marketReport.longTermRent?.qualification.included.length ?? 0} />
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

function money(value: number | undefined, suffix = ""): string { return value === undefined ? "Unavailable" : `$${Math.round(value).toLocaleString("en-US")}${suffix}`; }
function range(value: Readonly<{ lower: number; upper: number }> | undefined): string { return value ? `${money(value.lower)}–${money(value.upper)}` : "No supported range"; }
