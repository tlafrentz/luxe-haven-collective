"use client";

import { BriefcaseBusiness, Download, LineChart, MoreHorizontal } from "lucide-react";
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

const ROUTES_WITH_PAGE_EXPORT = ["/dashboard/observe/financial", "/dashboard/financial"];
export const PAGE_HEADER_ACTIONS_SLOT_ID = "workspace-header-page-actions";

export function IntelligenceWorkspaceHeader({ stage }: { stage: "observe" | "understand" }) {
  const pathname = usePathname();
  const hasPageOwnExport = ROUTES_WITH_PAGE_EXPORT.includes(pathname);
  const title = stage === "observe" ? "Observe" : "Understand";
  const description = stage === "observe" ? "Understand what is happening across your business." : "Gain clarity on why performance is happening and what matters most.";
  return <header className="mx-auto max-w-[1500px] px-4 pb-3 pt-6 sm:px-6 lg:px-8">
    <p className={["text-[11px] font-bold uppercase tracking-[0.12em]", stage === "observe" ? "text-emerald-700" : "text-violet-700"].join(" ")}>{title} <span className="px-2 text-stone-400">›</span> <span className="text-stone-950">{lenses[stage].find(lens => pathname.startsWith(lens.href))?.label}</span></p>
    <h1 className="mt-5 text-3xl font-semibold tracking-tight text-stone-950">{title}</h1>
    <p className="mt-2 text-xs text-stone-600">{description}</p>
    <div className="mt-5 flex items-start justify-between gap-4">
    <nav aria-label={`${title} intelligence lenses`} className="flex max-w-full gap-2 overflow-x-auto pb-1">
      {lenses[stage].map((lens, index) => {
        const active = pathname.startsWith(lens.href);
        const Icon = index === 0 ? LineChart : BriefcaseBusiness;
        return <ContextLink key={lens.href} href={lens.href} aria-current={active ? "page" : undefined} onClick={() => recordPlatformNavigationEvent(`${stage}_lens_selected`, { lens: lens.capability, destinationRoute: lens.href })} className={["inline-flex min-h-10 min-w-44 shrink-0 items-center justify-center gap-2 rounded-md border px-4 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2", active ? stage === "observe" ? "border-emerald-700 bg-emerald-50 text-emerald-950 shadow-sm" : "border-violet-600 bg-violet-50 text-violet-950 shadow-sm" : "border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-950"].join(" ")}><Icon aria-hidden="true" className="h-4 w-4" />{lens.label}</ContextLink>;
      })}
    </nav>
    <div className="hidden shrink-0 gap-2 sm:flex">{hasPageOwnExport ? <div id={PAGE_HEADER_ACTIONS_SLOT_ID} className="contents" /> : <ContextLink href="/dashboard/reports" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-stone-200 bg-white px-4 text-xs font-semibold text-stone-800"><Download className="h-3.5 w-3.5" />Export</ContextLink>}<button type="button" aria-label="More options" className="grid h-10 w-10 place-items-center rounded-md border border-stone-200 bg-white"><MoreHorizontal className="h-4 w-4" /></button></div>
    </div>
    <p className="sr-only" role="status" aria-live="polite">{lenses[stage].find(lens => pathname.startsWith(lens.href))?.label} selected</p>
  </header>;
}

export function WorkspaceLocalNavigation({ label, items }: { label: string; items: readonly Readonly<{ label: string; href: string; exact?: boolean }>[] }) {
  const pathname = usePathname();
  return <div className="bg-transparent"><nav aria-label={label} className="mx-auto flex max-w-[1500px] gap-7 overflow-x-auto border-b border-stone-200 px-4 sm:px-6 lg:px-8">{items.map(item => {
    const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
    return <ContextLink key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={["min-h-10 shrink-0 border-b-2 py-3 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal-600", active ? "border-emerald-700 text-emerald-900" : "border-transparent text-stone-500 hover:text-stone-950"].join(" ")}>{item.label}</ContextLink>;
  })}</nav></div>;
}
