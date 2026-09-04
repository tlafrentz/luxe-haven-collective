"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Boxes, ClipboardList, House, PackageCheck, Sofa, Truck, type LucideIcon } from "lucide-react";
import { ContextLink } from "@/platform/workspace-context";

export type FurnishingSection = "overview" | "product-library" | "room-packages" | "furnishing-plans" | "procurement" | "installations";
type Item = Readonly<{ id: FurnishingSection; label: string; href: string; icon: LucideIcon; prefixes: readonly string[] }>;

/**
 * FS-UX-010: one horizontal section menu. Product Library absorbs the
 * former Product Catalog/Products/Retailers/Imports surfaces; Furnishing
 * Plans absorbs Design Workspaces/Budgets. Imports, Release Controls, and
 * Settings remain reachable at their existing routes but are no longer
 * primary Furnishing Studio navigation (spec §4.1).
 */
export const furnishingNavigationItems: readonly Item[] = [
  { id: "overview", label: "Overview", href: "/admin/furnishing", icon: House, prefixes: ["/admin/furnishing"] },
  { id: "product-library", label: "Product Library", href: "/admin/furnishing/products", icon: Boxes, prefixes: ["/admin/furnishing/products", "/admin/furnishing/catalog", "/admin/furnishing/retailers", "/admin/furnishing/imports"] },
  { id: "room-packages", label: "Room Packages", href: "/admin/furnishing/room-packages", icon: Sofa, prefixes: ["/admin/furnishing/room-packages", "/admin/furnishing/packages", "/admin/furnishing/styles"] },
  { id: "furnishing-plans", label: "Furnishing Plans", href: "/admin/furnishing/workspaces", icon: ClipboardList, prefixes: ["/admin/furnishing/workspaces", "/admin/furnishing/projects", "/admin/furnishing/budgets"] },
  { id: "procurement", label: "Procurement", href: "/admin/furnishing/procurement", icon: Truck, prefixes: ["/admin/furnishing/procurement"] },
  { id: "installations", label: "Installations", href: "/admin/furnishing/installations", icon: PackageCheck, prefixes: ["/admin/furnishing/installations", "/admin/furnishing/installation"] },
] as const;

export function furnishingSectionForPath(pathname: string): FurnishingSection {
  const candidates = furnishingNavigationItems.filter((item) => item.id !== "overview").flatMap((item) => item.prefixes.map((prefix) => ({ item, prefix }))).filter(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)).sort((a, b) => b.prefix.length - a.prefix.length);
  return candidates[0]?.item.id ?? "overview";
}

export function FurnishingStudioShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(), active = furnishingSectionForPath(pathname);
  return <div className="mx-auto w-full max-w-[1600px] py-5 sm:py-7">
    <p className="px-4 text-[11px] font-bold uppercase tracking-[.18em] text-emerald-800 sm:px-0">Furnishing Studio</p>
    <nav aria-label="Furnishing Studio sections" className="mt-3 overflow-x-auto border-b border-stone-200 px-4 sm:px-0">
      <ul className="flex min-w-max gap-6">
        {furnishingNavigationItems.map((item) => {
          const Icon = item.icon, selected = item.id === active;
          return <li key={item.id}>
            <ContextLink
              href={item.href}
              prefetch={selected ? undefined : false}
              aria-current={selected ? "page" : undefined}
              className={`flex min-h-11 items-center gap-2 border-b-2 px-1 text-sm font-semibold outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 ${selected ? "border-emerald-700 text-emerald-950" : "border-transparent text-stone-600 hover:text-stone-950"}`}
            >
              <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
              {item.label}
            </ContextLink>
          </li>;
        })}
      </ul>
    </nav>
    <div className="mt-6 min-w-0">{children}</div>
  </div>;
}

export function FurnishingHeader({ title, description, action }: { title: string; description: string; current: string; action?: ReactNode }) {
  const pathname = usePathname(), section = furnishingNavigationItems.find((item) => item.id === furnishingSectionForPath(pathname))!;
  return <header className="flex flex-wrap items-end justify-between gap-5 border-b border-stone-200 pb-6"><div className="min-w-0"><nav aria-label="Breadcrumb" className="mb-3 text-sm text-stone-500"><ol className="flex min-w-0 items-center gap-2"><li><Link href="/admin/furnishing" className="rounded outline-none hover:text-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-700">Furnishing Studio</Link></li>{section.id !== "overview" ? <><li aria-hidden="true">/</li><li aria-current="page" className="truncate font-medium text-stone-700">{section.label}</li></> : null}</ol></nav><h1 className="text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">{title}</h1><p className="mt-2 max-w-3xl text-stone-600">{description}</p></div>{action ? <div className="shrink-0">{action}</div> : null}</header>;
}
export function Badge({ value }: { value: string }) { return <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-800">{value.replaceAll("_", " ")}</span>; }
export function Money({ value }: { value: unknown }) { return <>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0)}</>; }
