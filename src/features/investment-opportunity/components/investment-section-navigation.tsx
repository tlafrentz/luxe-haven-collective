import Link from "next/link";

export function InvestmentSectionNavigation({ active }: { active: "analysis" | "portfolio" }) {
  return <nav aria-label="Investment workspace" className="inline-flex rounded-xl border border-stone-200 bg-white p-1 shadow-sm">
    <Link href="/dashboard/investments" className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${active === "analysis" ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-100"}`}>Investment Analysis</Link>
    <Link href="/dashboard/investments/portfolio" className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${active === "portfolio" ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-100"}`}>Portfolio</Link>
  </nav>;
}
