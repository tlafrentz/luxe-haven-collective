"use client";

import { BriefcaseBusiness, LineChart } from "lucide-react";
import { usePathname } from "next/navigation";
import { ContextLink } from "@/platform/workspace-context";
import { recordPlatformNavigationEvent } from "@/platform/experience";

type Lens = Readonly<{ label: string; href: string; capability: string }>;

const lenses = {
  observe: [
    { label: "Revenue Intelligence", href: "/dashboard/observe/revenue", capability: "revenue" },
    { label: "Financial Intelligence", href: "/dashboard/observe/financial", capability: "financial" },
  ],
  understand: [
    { label: "Executive Intelligence", href: "/dashboard/understand/executive", capability: "executive" },
    { label: "Portfolio Intelligence", href: "/dashboard/understand/portfolio", capability: "portfolio" },
  ],
} satisfies Record<"observe" | "understand", readonly Lens[]>;

export function IntelligenceWorkspaceHeader({ stage }: { stage: "observe" | "understand" }) {
  const pathname = usePathname();
  const title = stage === "observe" ? "Observe" : "Understand";
  const description = stage === "observe" ? "Understand what is happening across your business." : "Gain clarity on why performance is happening and what matters most.";
  return <header className="mx-auto max-w-[1440px] px-4 pb-2 pt-7 sm:px-6 lg:px-8">
    <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-700">{title}</p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">{title}</h1>
    <p className="mt-2 text-sm text-stone-600">{description}</p>
    <nav aria-label={`${title} intelligence lenses`} className="mt-5 flex max-w-full gap-2 overflow-x-auto pb-1">
      {lenses[stage].map((lens, index) => {
        const active = pathname.startsWith(lens.href);
        const Icon = index === 0 ? LineChart : BriefcaseBusiness;
        return <ContextLink key={lens.href} href={lens.href} aria-current={active ? "page" : undefined} onClick={() => recordPlatformNavigationEvent(`${stage}_lens_selected`, { lens: lens.capability, destinationRoute: lens.href })} className={["inline-flex min-h-11 min-w-48 shrink-0 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2", active ? "border-teal-700 bg-teal-50 text-teal-950 shadow-sm" : "border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-950"].join(" ")}><Icon aria-hidden="true" className="h-4 w-4" />{lens.label}</ContextLink>;
      })}
    </nav>
    <p className="sr-only" role="status" aria-live="polite">{lenses[stage].find(lens => pathname.startsWith(lens.href))?.label} selected</p>
  </header>;
}

export function WorkspaceLocalNavigation({ label, items }: { label: string; items: readonly Readonly<{ label: string; href: string; exact?: boolean }>[] }) {
  const pathname = usePathname();
  return <div className="border-y border-stone-200 bg-white"><nav aria-label={label} className="mx-auto flex max-w-[1440px] gap-7 overflow-x-auto px-4 sm:px-6 lg:px-8">{items.map(item => {
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    return <ContextLink key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={["min-h-11 shrink-0 border-b-2 py-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal-600", active ? "border-teal-700 text-teal-900" : "border-transparent text-stone-500 hover:text-stone-950"].join(" ")}>{item.label}</ContextLink>;
  })}</nav></div>;
}
