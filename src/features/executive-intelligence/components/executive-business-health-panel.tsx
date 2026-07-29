import Link from "next/link";
import { AlertTriangle,ArrowRight,CircleGauge,HelpCircle,Lightbulb } from "lucide-react";
import { HPM_PILLARS,HPM_PILLAR_LABELS } from "@/features/hpm";
import type { ExecutiveBusinessHealthProjection } from "../domain";
import { SectionHeading } from "./section-heading";

export function ExecutiveBusinessHealthPanel({projection}:{projection:ExecutiveBusinessHealthProjection}){
  const focus=projection.attention[0];
  return <section className="space-y-5">
    <SectionHeading eyebrow="Executive reasoning" title="Where should I focus today?" description="Priorities are ranked from canonical evidence by urgency, impact, confidence, time sensitivity, and business value."/>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,.6fr)]">
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        {focus?<><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-rose-700"><AlertTriangle className="h-4 w-4"/>Highest priority · {focus.pillar.replace("-"," ")}</div>
          <h2 className="mt-3 text-2xl font-semibold text-stone-950">{focus.title}</h2><p className="mt-3 text-sm leading-6 text-stone-600">{focus.why}</p>
          <div className="mt-5 grid grid-cols-3 gap-3 text-sm"><Datum label="Impact" value={Math.round(focus.impact).toString()}/><Datum label="Confidence" value={focus.confidence===null?"Unknown":`${Math.round(focus.confidence)}%`}/><Datum label="Urgency" value={focus.urgency}/></div>
          {focus.destination?<Link className="mt-6 inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white" href={focus.destination}>Take action <ArrowRight className="h-4 w-4"/></Link>:<p className="mt-6 text-sm text-amber-700">Connect the missing source before taking action.</p>}</>:<p className="text-sm text-stone-600">No canonical evidence currently requires executive attention.</p>}
      </div>
      <div className="rounded-3xl bg-stone-950 p-6 text-white"><p className="text-xs font-semibold uppercase tracking-[.16em] text-white/50">Business health</p><p className="mt-3 text-5xl font-semibold">{projection.score??"—"}</p><p className="mt-2 capitalize text-white/70">{projection.status.replace("-"," ")}</p><div className="mt-6 border-t border-white/10 pt-5"><p className="text-sm">Confidence {projection.confidence.score===null?"unavailable":`${Math.round(projection.confidence.score)}%`}</p><p className="mt-1 text-xs text-white/50">{projection.confidence.availablePillars} of 7 pillars supported · {Math.round(projection.confidence.coverage*100)}% coverage</p></div></div>
    </div>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{HPM_PILLARS.map(key=>{const pillar=projection.pillars[key];return <details key={key} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><summary className="cursor-pointer list-none"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{HPM_PILLAR_LABELS[key]}</p><p className="mt-1 text-xs text-stone-500">{pillar.question}</p></div><CircleGauge className="h-5 w-5 text-stone-400"/></div><p className="mt-4 text-2xl font-semibold">{pillar.score??"Unavailable"}</p><p className="mt-1 text-xs capitalize text-stone-500">{pillar.status} · {pillar.confidence===null?"confidence unavailable":`${pillar.confidence}% confidence`}</p></summary><div className="mt-4 space-y-3 border-t pt-4 text-sm">{pillar.risks.map(item=><p className="flex gap-2 text-rose-700" key={item}><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0"/>{item}</p>)}{pillar.opportunities.map(item=><p className="flex gap-2 text-emerald-700" key={item}><Lightbulb className="mt-0.5 h-4 w-4 shrink-0"/>{item}</p>)}{pillar.limitations.map(item=><p className="flex gap-2 text-amber-700" key={item}><HelpCircle className="mt-0.5 h-4 w-4 shrink-0"/>{item}</p>)}{pillar.evidence.map(item=><Link className="block font-semibold underline" href={item.destination} key={item.artifactId}>{item.summary} →</Link>)}</div></details>})}</div>
    {projection.timeline.length?<div className="rounded-3xl border bg-white p-6"><h3 className="font-semibold">What changed?</h3><div className="mt-4 divide-y">{projection.timeline.map(item=><div className="py-4" key={item.id}><p className="text-sm font-semibold">{item.title}</p><p className="mt-1 text-sm text-stone-600">{item.summary}</p><p className="mt-1 text-xs text-stone-400">{item.occurredAt.slice(0,10)}</p></div>)}</div></div>:null}
  </section>
}
function Datum({label,value}:{label:string;value:string}){return<div><p className="text-xs text-stone-500">{label}</p><p className="mt-1 font-semibold capitalize">{value}</p></div>}
