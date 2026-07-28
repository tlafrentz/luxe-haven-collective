import Link from "next/link";
import { getReportWorkspace } from "@/app/actions/reporting";
import { Card } from "@/components/ui/card";

export default async function InvestmentReportsPage() {
  const workspace = await getReportWorkspace({ type: "investment-decision" });
  return <main className="mx-auto max-w-7xl space-y-8 px-5 py-10">
    <header className="flex flex-wrap items-end justify-between gap-5 border-b border-stone-200 pb-7">
      <div><p className="eyebrow">Investment Intelligence</p><h1 className="mt-2 font-serif text-4xl text-stone-950">Reports</h1><p className="mt-2 max-w-2xl text-sm text-stone-600">Investment decision reports generated only from saved analysis versions or persisted scenarios.</p></div>
      <Link href="/dashboard/reports/new?type=investment-decision" className="rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white">Generate Report</Link>
    </header>
    {!workspace ? <Card className="p-8"><p>Sign in to view investment reports.</p></Card> : workspace.reports.length ? <section className="grid gap-4 lg:grid-cols-2">{workspace.reports.map(report => <Card className="p-6" key={report.id}><p className="eyebrow">{report.report_number}</p><h2 className="mt-2 text-xl font-semibold">{report.title}</h2><p className="mt-2 text-sm capitalize text-stone-500">Version {report.version_number} · {report.status} · {report.confidence.replaceAll("-", " ")}</p><Link className="mt-5 inline-flex text-sm font-semibold underline" href={`/dashboard/reports/${report.id}`}>Open immutable report</Link></Card>)}</section> : <Card className="border-dashed p-10 text-center"><h2 className="text-xl font-semibold">No investment reports yet</h2><p className="mt-2 text-sm text-stone-600">Save an analysis or scenario before generating a report.</p></Card>}
    <Link className="inline-flex text-sm font-semibold underline" href="/dashboard/reports?type=investment-decision">Open full report library</Link>
  </main>;
}
