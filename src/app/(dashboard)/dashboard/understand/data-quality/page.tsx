import Link from "next/link";
import { getExecutiveIntelligenceView } from "@/features/executive-intelligence";
import { resolveAnalyticsDateRange } from "@/features/analytics";

type SearchParams = Promise<{property?:string;start?:string;end?:string;from?:string;to?:string}>;
export default async function DataQualityPage({searchParams}:Readonly<{searchParams:SearchParams}>) {
  const params=await searchParams;
  const range=resolveAnalyticsDateRange({startDate:params.from??params.start,endDate:params.to??params.end});
  const {view}=await getExecutiveIntelligenceView({propertyId:params.property??null,startDate:range.startDate,endDate:range.endDate});
  const quality=view.dataQuality;
  const total=quality.availablePillars.length+quality.unavailablePillars.length;
  const coverage=total?Math.round(quality.availablePillars.length/total*100):0;
  return <main className="mx-auto max-w-[1200px] space-y-6 px-4 pb-10 pt-3 sm:px-6 lg:px-8">
    <header className="rounded-[2rem] border border-stone-200 bg-white p-6 sm:p-8"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-700">Understand · Portfolio Intelligence · Data Quality</p><h1 className="mt-3 text-3xl font-semibold">Portfolio Data Quality</h1><p className="mt-2 text-sm text-stone-600">{quality.summary}</p><p className="mt-5 text-4xl font-semibold">{coverage}% <span className="text-base font-normal text-stone-500">coverage</span></p></header>
    <section className="grid gap-5 md:grid-cols-2"><QualityList title="Available evidence" items={quality.availablePillars} available/><QualityList title="Insufficient evidence" items={quality.unavailablePillars}/></section>
    <section className="rounded-[2rem] border border-stone-200 bg-white p-6"><h2 className="text-xl font-semibold">What needs attention</h2>{quality.gaps.length?<ul className="mt-4 divide-y">{quality.gaps.map((gap,index)=><li key={`${gap.type}:${index}`} className="py-4"><p className="font-semibold capitalize">{gap.type.replaceAll("-"," ")}</p><p className="mt-1 text-sm text-stone-600">{gap.message}</p></li>)}</ul>:<p className="mt-3 text-sm text-stone-600">No material evidence gaps were found.</p>}<Link href="/dashboard/workspace/connected-systems" className="mt-5 inline-flex rounded-md bg-stone-950 px-4 py-3 text-sm font-semibold text-white">Review data sources</Link></section>
  </main>;
}
function QualityList({title,items,available=false}:{title:string;items:readonly string[];available?:boolean}){return <section className="rounded-[2rem] border border-stone-200 bg-white p-6"><h2 className="text-xl font-semibold">{title}</h2>{items.length?<ul className="mt-4 space-y-3">{items.map(item=><li key={item} className="flex items-center gap-3 rounded-xl bg-stone-50 p-4 text-sm font-semibold"><span className={available?"text-emerald-700":"text-amber-700"}>{available?"●":"○"}</span><span className="capitalize">{item.replaceAll("-"," ")}</span></li>)}</ul>:<p className="mt-3 text-sm text-stone-600">None.</p>}</section>}
