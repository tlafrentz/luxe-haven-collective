"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Boxes, ChevronDown, CircleDollarSign, ClipboardList, FileUp, House, PackageCheck, Settings, ShieldCheck, Sofa, Truck, X, type LucideIcon } from "lucide-react";
import { ContextLink } from "@/platform/workspace-context";

export type FurnishingSection = "overview" | "catalog" | "imports" | "room-packages" | "workspaces" | "budgets" | "procurement" | "installations" | "release-controls" | "settings";
type Item = Readonly<{ id: FurnishingSection; label: string; href: string; icon: LucideIcon; prefixes: readonly string[] }>;

export const furnishingNavigationItems: readonly Item[] = [
  { id: "overview", label: "Overview", href: "/admin/furnishing", icon: House, prefixes: ["/admin/furnishing"] },
  { id: "catalog", label: "Product Catalog", href: "/admin/furnishing/catalog", icon: Boxes, prefixes: ["/admin/furnishing/catalog", "/admin/furnishing/products", "/admin/furnishing/retailers"] },
  { id: "imports", label: "Imports", href: "/admin/furnishing/imports", icon: FileUp, prefixes: ["/admin/furnishing/imports", "/admin/furnishing/products/import", "/admin/furnishing/packages/import"] },
  { id: "room-packages", label: "Room Packages", href: "/admin/furnishing/room-packages", icon: Sofa, prefixes: ["/admin/furnishing/room-packages", "/admin/furnishing/packages", "/admin/furnishing/styles"] },
  { id: "workspaces", label: "Design Workspaces", href: "/admin/furnishing/workspaces", icon: ClipboardList, prefixes: ["/admin/furnishing/workspaces", "/admin/furnishing/projects"] },
  { id: "budgets", label: "Budgets", href: "/admin/furnishing/budgets", icon: CircleDollarSign, prefixes: ["/admin/furnishing/budgets"] },
  { id: "procurement", label: "Procurement", href: "/admin/furnishing/procurement", icon: Truck, prefixes: ["/admin/furnishing/procurement"] },
  { id: "installations", label: "Installations", href: "/admin/furnishing/installations", icon: PackageCheck, prefixes: ["/admin/furnishing/installations", "/admin/furnishing/installation"] },
  { id: "release-controls", label: "Release Controls", href: "/admin/furnishing/release-controls", icon: ShieldCheck, prefixes: ["/admin/furnishing/release-controls", "/admin/furnishing/activation"] },
  { id: "settings", label: "Settings", href: "/admin/furnishing/settings", icon: Settings, prefixes: ["/admin/furnishing/settings"] },
] as const;

export function furnishingSectionForPath(pathname: string): FurnishingSection {
  const candidates = furnishingNavigationItems.filter((item) => item.id !== "overview").flatMap((item) => item.prefixes.map((prefix) => ({ item, prefix }))).filter(({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`)).sort((a, b) => b.prefix.length - a.prefix.length);
  return candidates[0]?.item.id ?? "overview";
}

export function FurnishingStudioShell({ children }: { children: ReactNode }) {
  const pathname = usePathname(), active = furnishingSectionForPath(pathname);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null), closeRef = useRef<HTMLButtonElement>(null), wasOpen = useRef(false);
  const current = furnishingNavigationItems.find((item) => item.id === active)!;
  useEffect(() => {
    if (!open) { document.body.style.overflow = ""; if (wasOpen.current) triggerRef.current?.focus(); wasOpen.current = false; return; }
    wasOpen.current = true; document.body.style.overflow = "hidden"; closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const focusable = closeRef.current?.closest("[role=dialog]")?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]');
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKeyDown); };
  }, [open]);
  return <div className="mx-auto w-full max-w-[1600px] py-5 sm:py-7">
    <div className="mb-5 px-4 sm:px-0 lg:hidden"><button ref={triggerRef} type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(true)} className="flex min-h-11 w-full items-center justify-between rounded-xl border border-stone-200 bg-white px-4 text-left shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"><span><span className="block text-[10px] font-bold uppercase tracking-[.16em] text-emerald-700">Furnishing Studio</span><span className="mt-0.5 block text-sm font-semibold text-stone-950">{current.label}</span></span><ChevronDown aria-hidden="true" className="h-5 w-5" /></button></div>
    <div className="grid min-w-0 lg:grid-cols-[224px_minmax(0,1fr)] lg:gap-8"><aside className="hidden lg:block"><div className="sticky top-24"><p className="px-3 text-[11px] font-bold uppercase tracking-[.18em] text-emerald-800">Furnishing Studio</p><LocalNavigation active={active} /></div></aside><div className="min-w-0">{children}</div></div>
    {open ? <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-labelledby="furnishing-menu-title"><button className="absolute inset-0 bg-stone-950/55" aria-label="Close Furnishing Studio menu" onClick={() => setOpen(false)} /><section className="relative h-full w-[88%] max-w-sm overflow-y-auto bg-white p-5 shadow-2xl"><div className="flex min-h-11 items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-emerald-700">Section menu</p><h2 id="furnishing-menu-title" className="text-xl font-semibold">Furnishing Studio</h2></div><button ref={closeRef} type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl outline-none hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-emerald-700"><X aria-hidden="true" /></button></div><LocalNavigation active={active} onNavigate={() => setOpen(false)} /></section></div> : null}
  </div>;
}

function LocalNavigation({ active, onNavigate }: { active: FurnishingSection; onNavigate?: () => void }) {
  return <nav aria-label="Furnishing Studio sections" className="mt-4"><ul className="space-y-1">{furnishingNavigationItems.map((item) => { const Icon = item.icon, selected = item.id === active; return <li key={item.id}><ContextLink href={item.href} prefetch={selected ? undefined : false} aria-current={selected ? "page" : undefined} onClick={onNavigate} className={`relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold outline-none transition-colors motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 ${selected ? "bg-emerald-50 text-emerald-950 before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-emerald-700" : "text-stone-600 hover:bg-stone-100 hover:text-stone-950"}`}><Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />{item.label}</ContextLink></li>; })}</ul></nav>;
}

/** @deprecated Local navigation is now owned by the shared Furnishing Studio layout. */
export function FurnishingNavigation({ current: _current }: { current: string }) { return null; }
export function FurnishingHeader({ title, description, action }: { title: string; description: string; current: string; action?: ReactNode }) {
  const pathname = usePathname(), section = furnishingNavigationItems.find((item) => item.id === furnishingSectionForPath(pathname))!;
  return <header className="flex flex-wrap items-end justify-between gap-5 border-b border-stone-200 pb-6"><div className="min-w-0"><nav aria-label="Breadcrumb" className="mb-3 text-sm text-stone-500"><ol className="flex min-w-0 items-center gap-2"><li><Link href="/admin/furnishing" className="rounded outline-none hover:text-emerald-800 focus-visible:ring-2 focus-visible:ring-emerald-700">Furnishing Studio</Link></li>{section.id !== "overview" ? <><li aria-hidden="true">/</li><li aria-current="page" className="truncate font-medium text-stone-700">{section.label}</li></> : null}</ol></nav><h1 className="text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">{title}</h1><p className="mt-2 max-w-3xl text-stone-600">{description}</p></div>{action ? <div className="shrink-0">{action}</div> : null}</header>;
}
export function Badge({ value }: { value: string }) { return <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold capitalize text-emerald-800">{value.replaceAll("_", " ")}</span>; }
export function Money({ value }: { value: unknown }) { return <>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value) || 0)}</>; }
