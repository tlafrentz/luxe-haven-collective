"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const destinations = [
  { label: "Overview", href: "/dashboard/investments", match: (path: string) => path === "/dashboard/investments" },
  { label: "Analyze", href: "/dashboard/investments/new", match: (path: string) => path.startsWith("/dashboard/investments/new") },
  { label: "Saved Scenarios", href: "/dashboard/investments/scenarios", match: (path: string) => path.startsWith("/dashboard/investments/scenarios") },
  { label: "Opportunities", href: "/dashboard/investments/opportunities", match: (path: string) => path.includes("/opportunities") || path.includes("/portfolio") },
  { label: "Reports", href: "/dashboard/investments/reports", match: (path: string) => path.startsWith("/dashboard/investments/reports") },
] as const;

export function InvestmentWorkspaceShellNavigation() {
  const pathname = usePathname();
  return <nav aria-label="Investment Intelligence workspace" className="overflow-x-auto border-b border-stone-200 bg-white px-4 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-7xl gap-7">
    {destinations.map(destination => {
      const active = destination.match(pathname);
      return <Link key={destination.href} href={destination.href} aria-current={active ? "page" : undefined} className={["whitespace-nowrap border-b-2 py-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2", active ? "border-stone-950 text-stone-950" : "border-transparent text-stone-500 hover:text-stone-950"].join(" ")}>{destination.label}</Link>;
    })}
  </div></nav>;
}
