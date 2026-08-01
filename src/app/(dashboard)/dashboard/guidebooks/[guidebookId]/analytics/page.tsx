import { notFound } from "next/navigation";
import { loadGuidebookAnalyticsSummaryAction } from "@/app/actions/guidebook-authoring";
import { GuidebookNavigation } from "@/components/guidebooks/guidebook-navigation";

export default async function GuidebookAnalyticsPage({ params }: Readonly<{ params: Promise<{ guidebookId: string }> }>) {
  const { guidebookId } = await params;
  const summary = await loadGuidebookAnalyticsSummaryAction({guidebookId});
  if (!summary.ok && summary.code === "GUIDEBOOK_UNAUTHORIZED") notFound();
  const events = summary.ok ? summary.value.events : [];
  const counts = new Map(events.map(event=>[event.eventType,event.count]));
  const sections = events.filter(event=>event.eventType==="section-open"&&event.sectionId).map(event=>[event.sectionId!,event.count]as const);
  const hasData = summary.ok && summary.value.available;
  return (
    <main className="mx-auto max-w-6xl space-y-6 py-8">
      <header><p className="text-xs font-semibold uppercase tracking-[.18em] text-amber-700">Guidebook Studio</p><h1 className="mt-2 text-4xl font-semibold">Guest engagement</h1><p className="mt-2 text-stone-600">Anonymous, privacy-safe guidebook activity. Counts do not represent verified guests.</p></header>
      <GuidebookNavigation guidebookId={guidebookId} current="analytics" />
      {!hasData ? <section className="rounded-3xl border border-dashed bg-white p-10 text-center"><h2 className="font-semibold">Analytics unavailable</h2><p className="mt-2 text-sm text-stone-500">No confirmed engagement summary is available. This is not reported as zero activity.</p></section> :
      <><section aria-label="Engagement summary" className="grid gap-4 sm:grid-cols-3"><Metric label="Views" value={counts.get("view")??0}/><Metric label="Link interactions" value={(counts.get("link-click")??0)+(counts.get("map-open")??0)+(counts.get("phone-tap")??0)}/><Metric label="Completed" value={counts.get("guidebook-completed")??0}/></section><section className="rounded-3xl border bg-white p-6"><h2 className="font-semibold">Most-opened sections</h2>{sections.length?<ol className="mt-4 space-y-3">{sections.sort((a,b)=>b[1]-a[1]).map(([section,count])=><li key={section} className="flex justify-between rounded-xl bg-stone-50 p-4"><span className="capitalize">{section.replaceAll("-"," ")}</span><span className="font-semibold">{count}</span></li>)}</ol>:<p className="mt-3 text-sm text-stone-500">Confirmed zero section-open events.</p>}</section></>}
    </main>
  );
}
function Metric({label,value}:{label:string;value:number}){return <div className="rounded-2xl border bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div>}
