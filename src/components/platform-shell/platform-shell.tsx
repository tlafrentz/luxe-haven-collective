"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  Boxes,
  Building2,
  ChevronDown,
  CircleGauge,
  ClipboardList,
  Headphones,
  History,
  House,
  Palette,
  PlugZap,
  ScrollText,
  ShieldCheck,
  UsersRound,
  type LucideProps,
} from "lucide-react";
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
const groupLabels: Record<string, string> = { home: "Home", hpm: "HPM lifecycle", business: "Business", services: "Services", settings: "Administration", operations: "Operations", infrastructure: "Infrastructure" };
const iconLabels: Record<string, string> = { home: "HM", observe: "OB", understand: "UN", portfolio: "PI", decide: "DC", execute: "EX", learn: "LN", property: "PR", investment: "IN", booking: "BK", message: "MS", report: "RP", service: "SV", settings: "ST", operations: "OP", integration: "IT", content: "CT" };
const availabilityLabels: Record<NavigationAvailability, string> = { available: "", "limited-preview": "Limited", "coming-soon": "Soon" };
const operationsIcons: Record<string, ComponentType<LucideProps>> = {
  "operations-workspace": House,
  "operations-customers": UsersRound,
  "operations-properties": Building2,
  "operations-support": Headphones,
  "guidebook-projects": ClipboardList,
  "design-projects": Palette,
  "service-catalog": Boxes,
  "platform-integrations": PlugZap,
  "platform-sync-history": History,
  "platform-health": CircleGauge,
  "platform-audit": ShieldCheck,
};

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

  return <div className="platform-workspace min-h-screen overflow-x-clip bg-background">
    <aside className={["fixed inset-y-0 left-0 z-40 hidden border-r border-white/10 bg-[#0b0f12] text-white transition-[width] motion-reduce:transition-none lg:block", collapsed ? "w-20" : "w-80"].join(" ")}>
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
          <div className="flex items-center gap-3"><EnvironmentIndicator /><span className="hidden rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 sm:inline-flex">{experience === "client-workspace" ? "Workspace" : "Internal"}</span><Link href={experience === "client-workspace" ? "/dashboard/workspace/preferences" : "/admin"} aria-label="Open user profile menu" className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-950 text-xs font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">TL</Link></div>
        </div>
      </header>
      <main id="main-content" className="sm:mx-6 lg:mx-8">{children}</main>
    </div>
  </div>;
}

function ShellNavigation({ experience, navigation, pathname, collapsed, onNavigate, onToggle }: { experience: PlatformExperience; navigation: readonly NavigationItem[]; pathname: string; collapsed: boolean; onNavigate: () => void; onToggle: () => void }) {
  const groups = [...new Set(navigation.map(item => item.group))];
  const byId = new Map(navigation.map(item => [item.id, item]));
  const activeHierarchy = new Set<string>();
  for (const item of navigation) {
    if (!item.activeMatch || !matchesNavigationRoute(pathname, item.activeMatch)) continue;
    activeHierarchy.add(item.id);
    let parentId = item.parentId;
    while (parentId) {
      activeHierarchy.add(parentId);
      parentId = byId.get(parentId)?.parentId;
    }
  }
  const operations = experience === "operations-console";
  return <div className="flex h-full flex-col bg-[#0b0f12]">
    <div className={operations ? "px-6 pb-5 pt-7" : "border-b border-white/10 px-5 py-5"}><div className="flex items-center justify-between"><Link href={experience === "client-workspace" ? "/dashboard" : "/admin"} onClick={onNavigate} className="min-w-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-amber-300">{operations ? <OperationsBrand collapsed={collapsed} /> : <><span className="block truncate text-xs font-semibold uppercase tracking-[0.22em] text-amber-200">Luxe Haven</span>{!collapsed ? <span className="mt-1 block truncate text-xl font-semibold">HPM Workspace</span> : null}</>}</Link><button type="button" onClick={onToggle} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"} className={operations && !collapsed ? "sr-only" : "hidden h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-stone-300 outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-teal-400 lg:flex"}>{collapsed ? "→" : "←"}</button></div>{!collapsed && experience === "client-workspace" ? <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2"><span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200">Current workspace</span><span className="mt-1 block truncate text-xs font-semibold text-stone-300">Luxe Haven Collective</span></div> : null}</div>
    {operations && !collapsed ? <div className="mx-6 border-t border-white/[0.08] pt-5"><p className="text-[12px] font-bold uppercase tracking-[0.08em] text-stone-100">Admin Portal</p></div> : null}
    <nav aria-label={experience === "client-workspace" ? "HPM workspace navigation" : "Operations Console navigation"} className={operations ? "flex-1 overflow-x-hidden overflow-y-auto px-4 pb-5 pt-4" : "flex-1 overflow-x-hidden overflow-y-auto px-3 py-5"}>
      {groups.map(group => <section key={group} aria-labelledby={`nav-${group}`} className={operations ? "mb-6" : "mb-5"}><h2 id={`nav-${group}`} className={collapsed || group === "home" ? "sr-only" : operations ? "mb-2.5 px-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#c9a85f]" : "mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-200"}>{groupLabels[group]}</h2><div className={operations ? "space-y-0.5" : "space-y-1"}>{navigation.filter(item => item.group === group).map(item => <NavigationEntry key={item.id} item={item} pathname={pathname} collapsed={collapsed} experience={experience} parentActive={activeHierarchy.has(item.id)} onNavigate={onNavigate} />)}</div></section>)}
    </nav>
    <div className={operations ? "border-t border-white/[0.08] px-4 py-4" : "border-t border-white/10 p-3"}><div className="flex min-h-14 items-center gap-3 rounded-xl px-2 text-stone-300"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-950">TL</span>{collapsed ? <span className="sr-only">Todd L, Administrator</span> : <><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">Todd L.</span><span className="block truncate text-xs text-stone-500">Administrator</span></span>{operations ? <ChevronDown aria-hidden="true" className="h-5 w-5 text-stone-300" /> : null}</>}</div></div>
  </div>;
}

function OperationsBrand({ collapsed }: { collapsed: boolean }) {
  return <span className="flex items-center gap-3"><span aria-hidden="true" className="inline-flex h-12 w-12 shrink-0 items-center justify-center text-xl font-black tracking-[-0.16em] text-[#d5b46b] [text-shadow:0_0_12px_rgba(213,180,107,0.16)]">LH</span>{collapsed ? <span className="sr-only">Luxe Haven Collective</span> : <span><span className="block text-[17px] font-bold uppercase tracking-[0.2em] text-[#d5b46b]">Luxe Haven</span><span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.3em] text-[#a98d55]">Collective</span></span>}</span>;
}

function NavigationEntry({ item, pathname, collapsed, experience, parentActive, onNavigate }: { item: NavigationItem; pathname: string; collapsed: boolean; experience: PlatformExperience; parentActive: boolean; onNavigate: () => void }) {
  if (collapsed && item.kind === "group") return null;
  const active = item.activeMatch ? matchesNavigationRoute(pathname, item.activeMatch) : false;
  if (item.kind === "group") return <div className="mt-3 flex min-h-8 items-center px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200" aria-expanded="true"><span>{item.label}</span><span className="sr-only">, {item.description}</span></div>;
  const disabled = item.availability !== "available" || !item.href;
  const status = item.availability === "available" ? null : availabilityLabels[item.availability];
  const operations = experience === "operations-console";
  const Icon = operationsIcons[item.id] ?? ScrollText;
  const content = <><span className={["relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", item.level === 3 ? "scale-90" : "", operations ? "border-white/[0.08] bg-[#171b1e] text-stone-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]" : active ? "border-white bg-white text-stone-950" : "border-white/10 bg-[#151719] text-stone-300"].join(" ")}>{operations ? <Icon aria-hidden="true" strokeWidth={1.9} className="h-[18px] w-[18px]" /> : <span className="text-[10px] font-semibold">{item.icon ? iconLabels[item.icon] : "•"}</span>}</span>{collapsed ? <><span className="sr-only">{item.label}{status ? `, ${status}` : ""}</span><span role="tooltip" className="pointer-events-none absolute left-full z-50 ml-3 hidden min-w-max rounded-lg bg-stone-800 px-3 py-2 text-xs font-semibold text-white shadow-xl group-hover/nav:block group-focus-visible/nav:block">{item.label}</span></> : <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="block text-sm font-semibold">{item.label}</span>{status ? <span aria-hidden="true" className="rounded-full border border-white/15 bg-[#111518] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-stone-300">{status}</span> : null}</span>{item.description && !operations ? <span className="mt-0.5 block text-xs leading-4 text-stone-500">{item.description}</span> : null}{status ? <span className="sr-only">Availability: {status}</span> : null}</span>}</>;
  const classes = ["group/nav relative flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-950", active ? operations ? "bg-white/[0.065] text-white" : "bg-white/[0.10] text-stone-200 ring-1 ring-white/10" : parentActive ? "text-stone-300" : disabled ? "cursor-default text-stone-400" : "text-stone-300 hover:bg-white/[0.05] hover:text-white"].join(" ");
  return disabled ? <div className={classes} aria-disabled="true" title={item.description}>{content}</div> : <Link href={item.href!} onClick={() => { recordPlatformNavigationEvent("platform_navigation_item_selected", { navigationItemId: item.id, destinationRoute: item.href }); onNavigate(); }} className={classes} aria-current={active ? "page" : undefined} title={collapsed ? item.label : undefined}>{content}</Link>;
}

type Crumb = Readonly<{ id: string; label: string; href?: string; current?: boolean }>;
function Breadcrumbs({ items }: { items: readonly Crumb[] }) { return <nav aria-label="Breadcrumb" className="mt-0.5 hidden sm:block"><ol className="flex items-center gap-1 text-xs text-stone-500">{items.map((item, index) => <li key={item.id} className="flex items-center gap-1">{index ? <span aria-hidden="true">/</span> : null}{item.href ? <Link className="rounded underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600" href={item.href}>{item.label}</Link> : <span aria-current={item.current ? "page" : undefined}>{item.label}</span>}</li>)}</ol></nav>; }
function EnvironmentIndicator() { return process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" ? <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900">Preview</span> : null; }

export function pageDetails(pathname: string, experience: PlatformExperience): { eyebrow: string; title: string; breadcrumbs: readonly Crumb[] } {
  if (experience === "operations-console") {
    const routes = [["/admin/customers", "Customers"], ["/admin/properties", "Properties"], ["/admin/support", "Support"], ["/admin/integrations", "Integrations"], ["/admin/sync-history", "Sync History"], ["/admin/provider-health", "Provider Health"], ["/admin/audit", "Audit"]] as const;
    const title = pathname === "/admin" ? "Workspace" : routes.find(([route]) => pathname.startsWith(route))?.[1] ?? "Operations";
    return { eyebrow: "Admin Portal / Operations", title, breadcrumbs: [{ id: "operations", label: "Operations", href: "/admin" }, { id: "current", label: title, current: true }] };
  }
  if (pathname.startsWith("/dashboard/portfolio")) {
    const workspace = pathname.startsWith("/dashboard/portfolio/workspace");
    return { eyebrow: "Understand", title: workspace ? "Portfolio Workspace" : "Portfolio Intelligence", breadcrumbs: [{ id: "home", label: "Home", href: "/dashboard" }, { id: "understand", label: "Understand", href: "/dashboard" }, { id: "portfolio", label: "Portfolio Intelligence", ...(workspace ? { href: "/dashboard/portfolio" } : { current: true }) }, ...(workspace ? [{ id: "current", label: "Workspace", current: true }] : [])] };
  }
  if (pathname.startsWith("/dashboard/financial")) return { eyebrow: "Understand", title: "Financial Intelligence", breadcrumbs: [{ id: "home", label: "Home", href: "/dashboard" }, { id: "understand", label: "Understand", href: "/dashboard" }, { id: "current", label: "Financial Intelligence", current: true }] };
  if (pathname.startsWith("/dashboard/investments")) {
    const destination = pathname === "/dashboard/investments" ? "Overview" : pathname.startsWith("/dashboard/investments/new") ? "New Analysis" : pathname.includes("/analyses/") ? "Investment Analysis" : pathname.includes("/compare") ? "Opportunity Comparison" : /\/(portfolio|opportunities)\/[^/]+/.test(pathname) ? "Investment Opportunity" : "Opportunity Portfolio";
    return { eyebrow: "Decide · Investment Intelligence", title: destination, breadcrumbs: [{ id: "home", label: "Home", href: "/dashboard" }, { id: "decide", label: "Decide", href: "/dashboard/investments" }, { id: "workspace", label: "Investment Intelligence", href: "/dashboard/investments" }, ...(destination === "Overview" ? [] : [{ id: "current", label: destination, current: true }])] };
  }
  if (pathname.startsWith("/dashboard/actions")) return { eyebrow: "Execute", title: "Action Center", breadcrumbs: [{ id: "home", label: "Home", href: "/dashboard" }, { id: "current", label: "Action Center", current: true }] };
  if (pathname.startsWith("/dashboard/communications")) return { eyebrow: "Observe · Understand · Execute", title: "Guest Communications", breadcrumbs: [{ id: "home", label: "Home", href: "/dashboard" }, { id: "communications", label: "Guest Communications", ...(pathname === "/dashboard/communications" ? { current: true } : { href: "/dashboard/communications" }) }, ...(pathname === "/dashboard/communications" ? [] : [{ id: "current", label: "Conversation", current: true }])] };
  if (pathname.startsWith("/dashboard/learning")) {
    const workspace = pathname.startsWith("/dashboard/learning/workspace");
    return { eyebrow: "Learn", title: workspace ? "Continuous Improvement" : "Learning Intelligence", breadcrumbs: [{ id: "home", label: "Home", href: "/dashboard" }, { id: "learning", label: "Learning Intelligence", ...(workspace ? { href: "/dashboard/learning" } : { current: true }) }, ...(workspace ? [{ id: "workspace", label: "Continuous Improvement", current: true }] : [])] };
  }
  if (pathname.startsWith("/dashboard/insights")) return { eyebrow: "Observe", title: "Revenue Intelligence", breadcrumbs: [{ id: "home", label: "Home", href: "/dashboard" }, { id: "current", label: "Revenue Intelligence", current: true }] };
  if (pathname.startsWith("/dashboard/workspace") || pathname.startsWith("/dashboard/settings")) return { eyebrow: "Business configuration", title: "Workspace", breadcrumbs: [{ id: "home", label: "Home", href: "/dashboard" }, { id: "current", label: "Workspace", current: true }] };
  if (pathname.startsWith("/bookings")) return { eyebrow: "Business operations", title: "Bookings", breadcrumbs: [{ id: "home", label: "Home", href: "/dashboard" }, { id: "current", label: "Bookings", current: true }] };
  if (pathname.startsWith("/properties")) return { eyebrow: "Business operations", title: "Properties", breadcrumbs: [{ id: "home", label: "Home", href: "/dashboard" }, { id: "current", label: "Properties", current: true }] };
  if (pathname.startsWith("/messages")) return { eyebrow: "Business", title: "Guest Communications", breadcrumbs: [{ id: "home", label: "Home", href: "/dashboard" }, { id: "current", label: "Guest Communications", current: true }] };
  if (pathname.startsWith("/reports")) return { eyebrow: "Business · Luxe Haven Press", title: "Hospitality Performance Reports", breadcrumbs: [{ id: "home", label: "Home", href: "/dashboard" }, { id: "current", label: "Reports", current: true }] };
  if (pathname.startsWith("/dashboard/guidebooks") || pathname.startsWith("/guidebooks")) return { eyebrow: "Execute · Guest experience", title: "Guidebook Studio", breadcrumbs: [{ id: "home", label: "Home", href: "/dashboard" }, { id: "current", label: "Guidebook Studio", current: true }] };
  return { eyebrow: "Home", title: "Home", breadcrumbs: [{ id: "current", label: "Home", current: true }] };
}
