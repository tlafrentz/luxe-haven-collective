import Link from "next/link";
import { ArrowRight, BarChart3, Lightbulb, Search } from "lucide-react";
import type { PortfolioWorkspaceView } from "@/features/investment-opportunity";
import { NewAnalysisDialog } from "./new-analysis-dialog";
import { InvestmentDraftResume } from "./investment-draft-resume";

type Props = Readonly<{ view?: PortfolioWorkspaceView; scenarioCount?: number; failed?: boolean; draftScope?: string }>;

export function InvestmentIntelligenceOverview({ view, scenarioCount = 0, failed = false, draftScope }: Props) {
  const recent = view?.opportunities.slice(0, 5) ?? [];
  return <main className="mx-auto w-full max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs text-stone-500">Decide <span className="mx-2">›</span> Investment Intelligence</p><h1 className="mt-3 font-serif text-3xl text-stone-950 sm:text-4xl">Investment Intelligence</h1><p className="mt-2 text-sm text-stone-600">Evaluate acquisitions before committing capital.</p></div>
      <NewAnalysisDialog />
    </header>
    <InvestmentDraftResume ownerScope={draftScope} />

    <section className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,.8fr)]">
      <div className="flex min-h-[320px] items-center rounded-xl border border-stone-200 bg-white p-7 shadow-sm">
        <div className="grid w-full items-center gap-8 md:grid-cols-[220px_1fr]">
          <div className="relative mx-auto flex h-48 w-48 items-center justify-center rounded-full bg-[#faf6ef]">
            <BarChart3 className="h-24 w-24 text-stone-200" strokeWidth={1.25} /><Search className="absolute bottom-9 right-7 h-14 w-14 text-[#9b6d28]" strokeWidth={1.5} />
          </div>
          <div><h2 className="font-serif text-2xl text-stone-950">No active analysis</h2><p className="mt-3 max-w-md text-sm leading-6 text-stone-600">Choose Purchase or Rental Arbitrage from the compact Start New Analysis control above. The guided workspace preserves the distinction between a draft, a saved scenario, and an opportunity.</p><Link href="/dashboard/investments/scenarios" className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[#9b6d28]">Review saved scenarios <ArrowRight className="h-4 w-4" /></Link></div>
        </div>
      </div>

      <aside className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between"><h2 className="font-semibold text-stone-950">Recent Opportunities</h2><Link href="/dashboard/investments/opportunities" className="text-xs font-medium text-[#9b6d28]">View all</Link></div>
        {failed ? <p className="mt-7 text-sm text-stone-600">Recent opportunities could not be loaded.</p> : recent.length ? <div className="mt-5 divide-y divide-stone-100">{recent.map(item => <Link href={`/dashboard/investments/opportunities/${item.id}`} key={item.id} className="flex items-center justify-between gap-4 py-3"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-stone-900">{item.name}</span><span className="mt-1 block text-xs text-stone-500">{relativeDate(item.updatedAt)}</span></span><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${item.route === "purchase" ? "bg-emerald-50 text-emerald-700" : "bg-violet-50 text-violet-700"}`}>{item.route === "purchase" ? "Purchase" : "Rental Arb."}</span></Link>)}</div> : <div className="flex min-h-48 flex-col items-center justify-center text-center"><p className="text-sm font-semibold text-stone-900">No opportunities yet</p><p className="mt-2 max-w-xs text-xs leading-5 text-stone-500">Promoted investment candidates will appear here.</p></div>}
      </aside>
    </section>

    <div className="mt-5 flex items-start gap-4 rounded-lg border border-[#eadcc7] bg-[#fcf7ef] px-6 py-4 text-sm text-stone-700"><Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-[#ad792c]" /><p>Start by creating a new analysis. You’ll be guided through each step and the platform will generate intelligence and recommendations as you go. <Link className="ml-1 font-semibold text-[#946522]" href="/dashboard/investments/scenarios">{scenarioCount} Saved Scenarios</Link></p></div>
  </main>;
}

function relativeDate(date: Date) {
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  return days === 0 ? "Updated today" : days === 1 ? "Updated yesterday" : `Updated ${days} days ago`;
}
