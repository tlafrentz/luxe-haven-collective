import Link from "next/link";
import { redirect } from "next/navigation";
import { CatalogCard, ReportLibraryTable, definitionAvailability } from "@/features/reporting-suite";
import { getGenerationOptions, getReportLibrary } from "@/features/reporting-suite/application/reporting-workspace-composition";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ generated?: string }> }) {
  const [library, options, params] = await Promise.all([getReportLibrary(), getGenerationOptions(), searchParams]);
  if (!library || !options) redirect("/login?next=/dashboard/reports");
  const generated = Boolean(params.generated && library.items.some(item => item.reportId === params.generated));
  const counts = {
    ready: library.items.filter(item => item.latestVersion.status === "ready").length,
    generating: library.items.filter(item => item.latestVersion.status === "generating").length,
    failed: library.items.filter(item => item.latestVersion.status === "failed").length,
    partial: library.items.filter(item => item.latestVersion.dataQuality === "partial").length,
  };
  return <main className="mx-auto max-w-7xl space-y-8 px-5 py-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-4xl font-semibold">Reports</h1><p className="mt-2 text-stone-600">Generate decision-ready reports from your portfolio, owner, investment, and operations data.</p></div><Link className="rounded-full bg-stone-950 px-5 py-3 font-semibold text-white" href="/dashboard/reports/new">Generate report</Link></header>
    {generated ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">Report created successfully. It is available under Recently Generated below.</p> : null}
    <nav aria-label="Report workspace" className="flex gap-5 border-b"><Link aria-current="page" className="border-b-2 border-emerald-800 py-3 font-semibold" href="/dashboard/reports">Overview</Link><Link className="py-3" href="/dashboard/reports/library">Report Library</Link><Link className="py-3" href="/dashboard/reports/new">Generate Report</Link></nav>
    {library.unavailable ? <p role="status" className="rounded-xl bg-amber-50 p-4">{library.message}</p> : null}
    <section aria-label="Reporting summary" className="grid gap-3 sm:grid-cols-4">{Object.entries(counts).map(([label,value])=><article className="rounded-xl border bg-white p-4" key={label}><strong className="text-2xl">{value}</strong><p className="text-sm capitalize text-stone-600">{label} reports</p></article>)}</section>
    <section><div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-semibold">Recently Generated</h2><Link className="font-semibold underline" href="/dashboard/reports/library">View library</Link></div><ReportLibraryTable items={library.items.slice(0,5)}/></section>
    <section><h2 className="text-2xl font-semibold">Available reports</h2><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{options.definitions.map(({definition})=>{const availability=definitionAvailability(definition,options.properties.length,options.analyses.length);return <CatalogCard definition={definition} available={availability.state==="available"} reason={"reason" in availability?availability.reason:undefined} key={definition.definitionId}/>})}</div></section>
  </main>;
}
