"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { PortfolioMetricSummary, PortfolioCondition } from "../application/overview";
import { understandRoutes } from "@/platform/experience";

export function SupportingSignalsDrawer({condition,metrics}:{condition:PortfolioCondition;metrics:readonly PortfolioMetricSummary[]}) {
  const [open,setOpen]=useState(false);
  const pathname=usePathname(),searchParams=useSearchParams();
  const returnTo=`${pathname}${searchParams?.size?`?${searchParams.toString()}`:""}`;
  const signals=metrics.filter(metric=>["gross-revenue","occupancy","adr"].includes(metric.metric));
  return <>
    <button type="button" onClick={()=>setOpen(true)} className="mt-5 inline-flex text-sm font-semibold text-teal-800 underline-offset-4 hover:underline">Inspect supporting signals</button>
    {open?<div className="fixed inset-0 z-50 bg-black/20" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}><aside role="dialog" aria-modal="true" aria-label="Supporting signals" className="ml-auto flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"><header className="flex items-center justify-between border-b p-5"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-700">Understand › Portfolio Intelligence › Supporting Signals</p><h2 className="mt-1 text-xl font-semibold">Supporting Signals</h2></div><button type="button" aria-label="Close supporting signals" onClick={()=>setOpen(false)} className="grid h-10 w-10 place-items-center rounded-md hover:bg-stone-100"><X className="h-4 w-4"/></button></header><div className="flex-1 overflow-y-auto p-5"><p className="text-sm leading-6 text-stone-700">{condition.explanation}</p><ul className="mt-5 divide-y rounded-xl border">{signals.map(signal=><Signal key={signal.metric} signal={signal}/>)}</ul><section className="mt-5 rounded-xl bg-stone-50 p-4"><h3 className="text-sm font-semibold">Interpretation</h3><p className="mt-2 text-sm leading-6 text-stone-600">{condition.primaryDriver} {condition.primaryLimitation??"The available evidence does not indicate a material limitation."}</p></section><div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={()=>setOpen(false)} className="rounded-md border px-4 py-3 text-sm font-semibold">Close</button><Link href={`${understandRoutes.portfolioDataQuality}?returnTo=${encodeURIComponent(returnTo)}`} className="rounded-md bg-stone-950 px-4 py-3 text-sm font-semibold text-white">Investigate further</Link></div></div></aside></div>:null}
  </>;
}

function Signal({signal}:{signal:PortfolioMetricSummary}) {
  const value=signal.current.state==="available"?format(signal.metric,signal.current.value):"Unavailable";
  const movement=signal.change?`${signal.change.absolute>=0?"↑":"↓"} ${Math.abs(signal.change.unit==="percentage-points"?signal.change.absolute*100:(signal.change.percentage??signal.change.absolute)*100).toFixed(1)}${signal.change.unit==="currency"?"%":" pts"}`:"No reliable comparison";
  return <li className="p-4"><div className="flex items-start justify-between gap-4"><div><h3 className="font-semibold">{label(signal.metric)}</h3><p className="mt-1 text-2xl font-semibold">{value}</p></div><span className="text-sm font-semibold text-stone-600">{movement}</span></div><dl className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-stone-500">Confidence</dt><dd className="mt-1 font-semibold">{label(signal.confidence)}</dd></div><div><dt className="text-stone-500">Freshness</dt><dd className="mt-1 font-semibold">{label(signal.freshness)}</dd></div></dl></li>;
}
function label(value:string){return value.replaceAll("-"," ").replace(/\b\w/g,character=>character.toUpperCase())}
function format(metric:string,value:number){if(["gross-revenue","adr","revpar"].includes(metric))return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(value);if(metric==="occupancy")return `${(value*100).toFixed(1)}%`;return new Intl.NumberFormat("en-US").format(value)}
