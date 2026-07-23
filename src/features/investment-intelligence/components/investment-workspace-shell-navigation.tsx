"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const destinations = [
  { label: "Overview", href: "/dashboard/investments", match: (path: string) => path === "/dashboard/investments" },
  { label: "New Analysis", href: "/dashboard/investments/new", match: (path: string) => path.startsWith("/dashboard/investments/new") },
  { label: "Opportunity Portfolio", href: "/dashboard/investments/opportunities", match: (path: string) => path.includes("/opportunities") || path.includes("/portfolio") },
] as const;

export function InvestmentWorkspaceShellNavigation() {
  const pathname = usePathname();
  return <nav aria-label="Investment Intelligence workspace" className="overflow-x-auto border-b border-stone-200 bg-white px-4 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl gap-7">
    {destinations.map(destination => {
      const active = destination.match(pathname);
      return <Link key={destination.href} href={destination.href} aria-current={active ? "page" : undefined} className={["whitespace-nowrap border-b-2 py-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2", active ? "border-stone-950 text-stone-950" : "border-transparent text-stone-500 hover:text-stone-950"].join(" ")}>{destination.label}</Link>;
    })}
    <span aria-disabled="true" title="Saved Scenarios is coming soon" className="whitespace-nowrap border-b-2 border-transparent py-4 text-sm font-semibold text-stone-400">Saved Scenarios <span className="ml-1 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] uppercase tracking-wide">Soon</span><span className="sr-only">, coming soon</span></span>
  </div></nav>;
}
