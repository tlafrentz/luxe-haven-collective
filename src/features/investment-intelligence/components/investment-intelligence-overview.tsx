import Link from "next/link";
import type { PortfolioWorkspaceView } from "@/features/investment-opportunity";

type Props = Readonly<{ view?: PortfolioWorkspaceView; failed?: boolean }>;
const actions = [
  { title: "New Analysis", description: "Start a new acquisition analysis from scratch.", href: "/dashboard/investments/new", icon: "+" },
  { title: "Opportunities", description: "View and manage properties under active investment consideration.", href: "/dashboard/investments/opportunities", icon: "◇" },
  { title: "Scenarios", description: "Review saved underwriting scenarios and comparisons.", href: "/dashboard/investments/scenarios", icon: "□" },
] as const;

export function InvestmentIntelligenceOverview({ view, failed = false }: Props) {
  const recent = view?.opportunities.slice(0, 5) ?? [];
  return <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
    <section className="border-b border-stone-200 pb-9">
      <div className="max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">Decide</p><h1 className="mt-4 font-serif text-4xl leading-tight text-stone-950 sm:text-5xl">Investment Intelligence</h1><p className="mt-4 max-w-3xl text-base leading-7 text-stone-600">Evaluate opportunities, model scenarios, and make better investment decisions with confidence.</p></div>
    </section>
    <section aria-labelledby="workspace-actions" className="py-8"><h2 id="workspace-actions" className="sr-only">Workspace actions</h2><div className="grid gap-4 md:grid-cols-3">{actions.map(action => <Link key={action.href} href={action.href} className="group rounded-2xl border border-stone-200 bg-white p-6 shadow-sm outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 motion-reduce:transform-none"><span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-xl text-teal-700">{action.icon}</span><h3 className="mt-5 text-base font-semibold text-stone-950">{action.title}</h3><p className="mt-2 text-sm leading-6 text-stone-600">{action.description}</p></Link>)}</div></section>
    <section aria-labelledby="recent-opportunities" className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"><div className="border-b border-stone-200 px-5 py-5 sm:px-7"><h2 id="recent-opportunities" className="font-serif text-2xl text-stone-950">Recent Opportunities</h2></div>
      {failed ? <div className="p-8"><p className="font-semibold text-stone-950">Recent opportunities could not be loaded.</p><p className="mt-1 text-sm text-stone-600">Try again. You can still start a new analysis.</p></div> : recent.length ? <div className="divide-y divide-stone-100">{recent.map(item => <Link href={`/dashboard/investments/opportunities/${item.id}`} key={item.id} className="grid gap-3 px-5 py-4 outline-none hover:bg-stone-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 sm:grid-cols-[minmax(0,2fr)_1fr_1fr_auto] sm:items-center sm:px-7"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-stone-950">{item.name}</span><span className="block truncate text-xs text-stone-500">{item.address}</span></span><span className="text-sm capitalize text-stone-600">{item.route.replace("-", " ")}</span><span className="text-sm capitalize text-stone-600">{item.status.replace("-", " ")}</span><time dateTime={item.updatedAt.toISOString()} className="text-xs text-stone-500">{relativeDate(item.updatedAt)}</time></Link>)}</div> : <div className="p-8 text-center"><p className="font-semibold text-stone-950">No opportunities yet</p><p className="mt-2 text-sm text-stone-600">Save an investment analysis to begin building your acquisition pipeline.</p><Link href="/dashboard/investments/new" className="mt-5 inline-flex rounded-xl bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">Start a new analysis</Link></div>}
      <div className="border-t border-stone-200 px-5 py-4 sm:px-7"><Link href="/dashboard/investments/opportunities" className="text-sm font-semibold text-stone-950 underline-offset-4 hover:underline">View all opportunities →</Link></div>
    </section>
  </div>;
}

function relativeDate(date: Date) {
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}
