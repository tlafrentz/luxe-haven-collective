"use client";

import { useMemo } from "react";
import { buildPreliminaryFinancialPreview, type LiveMetricStatus } from "../application/preview";
import { useInvestmentWorkspaceState } from "./investment-workspace-state";

const STATUS_LABELS: Record<LiveMetricStatus, string> = { healthy: "Healthy", caution: "Watch", weak: "Weak", neutral: "Pending" };
const STATUS_CLASSES: Record<LiveMetricStatus, string> = { healthy: "border-emerald-300/20 bg-emerald-300/10 text-emerald-100", caution: "border-amber-300/20 bg-amber-300/10 text-amber-100", weak: "border-rose-300/20 bg-rose-300/10 text-rose-100", neutral: "border-white/10 bg-white/[0.05] text-white/60" };

export function LiveInvestmentSummary() {
  const { values } = useInvestmentWorkspaceState();
  const preview = useMemo(() => buildPreliminaryFinancialPreview(values), [values]);
  return <section id="underwriting-preview" aria-labelledby="preliminary-preview-title" className="scroll-mt-6 rounded-3xl border border-neutral-200 bg-neutral-950 p-6 text-white shadow-sm sm:p-7">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Preliminary · directional</p><h2 id="preliminary-preview-title" className="mt-2 text-xl font-semibold tracking-tight">{preview.title}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">{preview.disclaimer}</p></div><span className="w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/75">{preview.route === "purchase" ? "Purchase" : "Rental arbitrage"}</span></header>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">{preview.metrics.map((metric, index) => <details key={metric.id} className={["group rounded-2xl border border-white/10 bg-white/[0.04] p-4 focus-within:ring-2 focus-within:ring-white/60", index === preview.metrics.length - 1 ? "sm:col-span-2 lg:col-span-1" : ""].join(" ")}><summary className="cursor-pointer list-none rounded-lg focus-visible:outline-none"><div className="flex items-start justify-between gap-2"><span className="text-xs font-medium text-white/55">{metric.label}</span><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${STATUS_CLASSES[metric.status]}`}>{STATUS_LABELS[metric.status]}</span></div><span className="mt-3 block text-xl font-semibold tracking-tight">{metric.formattedValue}</span><span className="mt-2 block text-xs leading-5 text-white/55">{metric.rationale}</span><span className="mt-3 block text-xs font-semibold text-white/75 group-open:hidden">Show calculation</span></summary><div className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-white/65"><p className="font-semibold text-white/85">{metric.formulaLabel}</p><p className="mt-1">{metric.formulaDescription}</p><ul className="mt-3 space-y-1">{metric.inputs.map(input => <li key={input.label}>{input.label}: <span className="font-semibold text-white/85">{input.formattedValue}</span> · {input.source}</li>)}</ul><p className="mt-3">{metric.thresholdExplanation}</p>{metric.improvementDirection ? <p className="mt-2"><span className="font-semibold text-white/85">Review:</span> {metric.improvementDirection}</p> : null}</div></details>)}</div>
    <p className="mt-4 text-xs leading-5 text-white/45">Open any metric for its canonical formula, inputs, threshold interpretation, rationale, and improvement direction. Status is always shown in text as well as color.</p>
  </section>;
}
