"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartNoAxesCombined, House, PanelsTopLeft } from "lucide-react";

const destinations = [
  { label: "Analyze", icon: ChartNoAxesCombined, href: "/dashboard/investments", match: (path: string) => path === "/dashboard/investments" || path.startsWith("/dashboard/investments/new") },
  { label: "Saved Scenarios", icon: PanelsTopLeft, href: "/dashboard/investments/scenarios", match: (path: string) => path.startsWith("/dashboard/investments/scenarios") },
  { label: "Opportunities", icon: House, href: "/dashboard/investments/opportunities", match: (path: string) => path.includes("/opportunities") || path.includes("/portfolio") },
] as const;

export function InvestmentWorkspaceShellNavigation() {
  const pathname = usePathname();
  return <nav aria-label="Investment Intelligence workspace" className="overflow-x-auto border-b border-stone-200 bg-white px-4 sm:px-6 lg:px-8"><div className="mx-auto flex max-w-[1440px] gap-9">
    {destinations.map(destination => {
      const active = destination.match(pathname);
      const Icon = destination.icon;
      return <Link key={destination.href} href={destination.href} aria-current={active ? "page" : undefined} className={["inline-flex items-center gap-2 whitespace-nowrap border-b-2 py-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2", active ? "border-stone-950 text-stone-950" : "border-transparent text-stone-500 hover:text-stone-950"].join(" ")}><Icon aria-hidden="true" className="h-4 w-4" />{destination.label}</Link>;
    })}
  </div></nav>;
}
