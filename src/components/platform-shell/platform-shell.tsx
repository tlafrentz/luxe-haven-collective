"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  clientWorkspaceNavigation,
  operationsConsoleNavigation,
  matchesNavigationRoute,
  recordPlatformNavigationEvent,
  resolveNavigation,
  resolveUserCapabilities,
  type NavigationAvailability,
  type NavigationItem,
  type PlatformExperience,
} from "@/platform/experience";

type ShellProps = Readonly<{ children: ReactNode; experience: PlatformExperience; role?: string | null }>;
const groupLabels: Record<string, string> = { home: "Home", hpm: "HPM lifecycle", business: "Business", services: "Services", settings: "Settings", operations: "Operations", infrastructure: "Infrastructure" };
const iconLabels: Record<string, string> = { home: "HM", observe: "OB", understand: "UN", decide: "DC", execute: "EX", learn: "LN", property: "PR", investment: "IN", booking: "BK", message: "MS", report: "RP", service: "SV", settings: "ST", operations: "OP", integration: "IT", content: "CT" };
const availabilityLabels: Record<NavigationAvailability, string> = { available: "", "limited-preview": "Limited", "coming-soon": "Soon" };

export function ClientWorkspaceShell({ children, role }: Omit<ShellProps, "experience">) { return <PlatformShell experience="client-workspace" role={role}>{children}</PlatformShell>; }
export function OperationsConsoleShell({ children, role }: Omit<ShellProps, "experience">) { return <PlatformShell experience="operations-console" role={role}>{children}</PlatformShell>; }

export function PlatformShell({ children, experience, role }: ShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const source = experience === "client-workspace" ? clientWorkspaceNavigation : operationsConsoleNavigation;
  const navigation = resolveNavigation(source, resolveUserCapabilities({ authenticated: true, role }));
  const details = pageDetails(pathname, experience);

  useEffect(() => {
    const saved = window.localStorage.getItem(`luxe-haven:${experience}:sidebar-collapsed`);
    if (saved !== "true") return;
    const frame = window.requestAnimationFrame(() => setCollapsed(true));
    return () => window.cancelAnimationFrame(frame);
  }, [experience]);
  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = "";
      if (wasOpen.current) triggerRef.current?.focus();
      wasOpen.current = false;
      return;
    }
    wasOpen.current = true;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKeyDown); };
  }, [mobileOpen]);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    window.localStorage.setItem(`luxe-haven:${experience}:sidebar-collapsed`, String(next));
    recordPlatformNavigationEvent("platform_navigation_collapsed", { experience, collapsed: next });
  };

  return <div className="min-h-screen overflow-x-clip bg-[#f8f7f4]">
    <aside className={["fixed inset-y-0 left-0 z-40 hidden border-r border-white/10 bg-[#0b0d0e] text-white transition-[width] motion-reduce:transition-none lg:block", collapsed ? "w-20" : "w-80"].join(" ")}>
      <ShellNavigation experience={experience} navigation={navigation} pathname={pathname} collapsed={collapsed} onNavigate={() => undefined} onToggle={toggleCollapsed} />
    </aside>
    {mobileOpen ? <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={`${experience === "client-workspace" ? "Workspace" : "Operations Console"} navigation`}>
      <button type="button" aria-label="Close navigation menu" className="absolute inset-0 bg-stone-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      <aside className="relative h-full w-[88%] max-w-96 shadow-2xl"><ShellNavigation experience={experience} navigation={navigation} pathname={pathname} collapsed={false} onNavigate={() => setMobileOpen(false)} onToggle={() => undefined} /></aside>
    </div> : null}
    <div className={collapsed ? "lg:pl-20" : "lg:pl-80"}>
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-[#f8f7f4]/95 backdrop-blur-xl">
        <div className="flex min-h-20 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button ref={triggerRef} type="button" onClick={() => { setMobileOpen(true); recordPlatformNavigationEvent("platform_mobile_navigation_opened", { experience }); }} aria-label="Open navigation menu" aria-expanded={mobileOpen} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-950 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 lg:hidden"><span aria-hidden="true">☰</span></button>
            <div className="min-w-0"><p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">{details.eyebrow}</p><p className="truncate text-lg font-semibold text-stone-950">{details.title}</p><Breadcrumbs items={details.breadcrumbs} /></div>
          </div>
          <div className="flex items-center gap-3"><EnvironmentIndicator /><span className="hidden rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 sm:inline-flex">{experience === "client-workspace" ? "Workspace" : "Internal"}</span><Link href={experience === "client-workspace" ? "/dashboard/settings" : "/admin"} aria-label="Open user profile menu" className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-950 text-xs font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">TL</Link></div>
        </div>
      </header>
      <main id="main-content">{children}</main>
    </div>
  </div>;
}

function ShellNavigation({ experience, navigation, pathname, collapsed, onNavigate, onToggle }: { experience: PlatformExperience; navigation: readonly NavigationItem[]; pathname: string; collapsed: boolean; onNavigate: () => void; onToggle: () => void }) {
  const groups = [...new Set(navigation.map(item => item.group))];
  return <div className="flex h-full flex-col bg-[#0b0d0e]">
    <div className="flex min-h-24 items-center justify-between border-b border-white/10 px-5"><Link href={experience === "client-workspace" ? "/dashboard" : "/admin"} onClick={onNavigate} className="min-w-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-teal-400"><span className="block truncate text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">Luxe Haven</span>{!collapsed ? <span className="mt-1 block truncate text-xl font-semibold">{experience === "client-workspace" ? "HPM Workspace" : "Operations Console"}</span> : null}</Link><button type="button" onClick={onToggle} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} className="hidden h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-stone-300 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-teal-400 lg:flex">{collapsed ? "→" : "←"}</button></div>
    <nav aria-label={experience === "client-workspace" ? "HPM workspace navigation" : "Operations Console navigation"} className="flex-1 overflow-y-auto px-3 py-5">
      {groups.map(group => <section key={group} aria-labelledby={`nav-${group}`} className="mb-5"><h2 id={`nav-${group}`} className={collapsed ? "sr-only" : "mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500"}>{groupLabels[group]}</h2><div className={group === "hpm" ? "relative space-y-1 before:absolute before:bottom-7 before:left-[27px] before:top-7 before:w-px before:bg-white/10" : "space-y-1"}>{navigation.filter(item => item.group === group).map(item => <NavigationEntry key={item.id} item={item} pathname={pathname} collapsed={collapsed} experience={experience} onNavigate={onNavigate} />)}</div></section>)}
    </nav>
    <div className="border-t border-white/10 p-3"><div className="flex min-h-14 items-center gap-3 rounded-xl px-3 text-stone-300"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-stone-950">TL</span>{collapsed ? <span className="sr-only">Todd L, Administrator</span> : <span><span className="block text-sm font-semibold text-white">Todd L</span><span className="block text-xs text-stone-500">Administrator</span></span>}</div></div>
  </div>;
}

function NavigationEntry({ item, pathname, collapsed, experience, onNavigate }: { item: NavigationItem; pathname: string; collapsed: boolean; experience: PlatformExperience; onNavigate: () => void }) {
  const active = matchesNavigationRoute(pathname, item.activeMatch);
  const disabled = item.availability !== "available" || !item.href;
  const status = item.availability === "available" ? null : availabilityLabels[item.availability];
  const content = <><span className={["relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-[10px] font-semibold", active ? experience === "operations-console" ? "border-amber-400/40 bg-amber-400/10 text-amber-200" : "border-white bg-white text-stone-950" : "border-white/10 bg-[#151719] text-stone-300"].join(" ")}>{iconLabels[item.icon]}</span>{collapsed ? <span className="sr-only">{item.label}{item.workspaceLabel ? `, ${item.workspaceLabel}` : ""}{status ? `, ${status}` : ""}</span> : <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="block truncate text-sm font-semibold">{item.label}</span>{status ? <span aria-hidden="true" className="rounded-full border border-white/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-stone-400">{status}</span> : null}</span>{item.workspaceLabel ? <span className="mt-0.5 block truncate text-xs text-stone-400">{item.workspaceLabel}</span> : item.description && experience === "operations-console" ? <span className="mt-0.5 block text-xs leading-4 text-stone-500">{item.description}</span> : null}{status ? <span className="sr-only">Availability: {status}</span> : null}</span>}</>;
  const classes = ["relative flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950", active ? experience === "operations-console" ? "border-l-2 border-amber-400 bg-white/[0.08] text-white" : "bg-white/[0.10] text-white ring-1 ring-white/10" : disabled ? "cursor-default text-stone-500" : "text-stone-300 hover:bg-white/[0.06] hover:text-white"].join(" ");
  return disabled ? <div className={classes} aria-disabled="true" title={item.description}>{content}</div> : <Link href={item.href!} onClick={() => { recordPlatformNavigationEvent("platform_navigation_item_selected", { navigationItemId: item.id, destinationRoute: item.href }); onNavigate(); }} className={classes} aria-current={active ? "page" : undefined}>{content}</Link>;
}

type Crumb = Readonly<{ id: string; label: string; href?: string; current?: boolean }>;
function Breadcrumbs({ items }: { items: readonly Crumb[] }) { return <nav aria-label="Breadcrumb" className="mt-0.5 hidden sm:block"><ol className="flex items-center gap-1 text-xs text-stone-500">{items.map((item, index) => <li key={item.id} className="flex items-center gap-1">{index ? <span aria-hidden="true">/</span> : null}{item.href ? <Link className="rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600" href={item.href}>{item.label}</Link> : <span aria-current={item.current ? "page" : undefined}>{item.label}</span>}</li>)}</ol></nav>; }
function EnvironmentIndicator() { return process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900">Preview</span> : null; }

export function pageDetails(pathname: string, experience: PlatformExperience): { eyebrow: string; title: string; breadcrumbs: readonly Crumb[] } {
  if (experience === "operations-console") {
    const title = pathname === "/admin" ? "Operations Console" : pathname.startsWith("/admin/integrations") ? "Integrations" : pathname.startsWith("/admin/properties") ? "Properties" : pathname.startsWith("/admin/owners") ? "Customers" : pathname.startsWith("/admin/inquiries") ? "Support" : "Operations Console";
    return { eyebrow: "Internal operations", title, breadcrumbs: [{ id: "operations", label: "Operations Console", href: "/admin" }, { id: "current", label: title, current: true }] };
  }
  if (pathname.startsWith("/dashboard/portfolio")) return { eyebrow: "Understand", title: "Portfolio Intelligence", breadcrumbs: [{ id: "home", label: "Home", href: "/dashboard" }, { id: "understand", label: "Understand", href: "/dashboard" }, { id: "current", label: "Portfolio Intelligence", current: true }] };
  if (pathname.startsWith("/dashboard/investments")) {
    const destination = pathname === "/dashboard/investments" ? "Overview" : pathname.startsWith("/dashboard/investments/new") ? "New Analysis" : pathname.includes("/analyses/") ? "Investment Analysis" : pathname.includes("/compare") ? "Opportunity Comparison" : /\/(portfolio|opportunities)\/[^/]+/.test(pathname) ? "Investment Opportunity" : "Opportunity Portfolio";
    return { eyebrow: "Decide · Investment Intelligence", title: destination, breadcrumbs: [{ id: "home", label: "Home", href: "/dashboard" }, { id: "decide", label: "Decide", href: "/dashboard/investments" }, { id: "workspace", label: "Investment Intelligence", href: "/dashboard/investments" }, ...(destination === "Overview" ? [] : [{ id: "current", label: destination, current: true }])] };
  }
  if (pathname.startsWith("/dashboard/actions")) return { eyebrow: "Execute", title: "Action Center", breadcrumbs: [{ id: "home", label: "Home", href: "/dashboard" }, { id: "current", label: "Action Center", current: true }] };
  if (pathname.startsWith("/dashboard/insights")) return { eyebrow: "Observe", title: "Revenue Intelligence", breadcrumbs: [{ id: "home", label: "Home", href: "/dashboard" }, { id: "current", label: "Revenue Intelligence", current: true }] };
  return { eyebrow: "Home", title: "Home", breadcrumbs: [{ id: "current", label: "Home", current: true }] };
}
