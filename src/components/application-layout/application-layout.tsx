"use client";

import Link from "next/link";
import type { HTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { AlertTriangle, ArrowRight, CircleHelp, Inbox, RotateCcw } from "lucide-react";

import { ClientWorkspaceShell } from "@/components/platform-shell";
import { cn } from "@/lib/utils";

export type WorkspaceWidth = "wide" | "medium" | "narrow";
export type WorkspaceCardLevel = 1 | 2 | 3;

export const applicationLayoutTokens = Object.freeze({
  maxContentWidth: "1440px",
  spacing: Object.freeze({ xs: "8px", sm: "16px", md: "24px", lg: "32px", xl: "48px", xxl: "64px" }),
  columns: Object.freeze({ mobile: 1, tablet: 6, desktop: 12 }),
  breakpoints: Object.freeze({ tablet: "768px", desktop: "1024px" }),
});

const widthClasses: Record<WorkspaceWidth, string> = {
  wide: "max-w-[1440px]",
  medium: "max-w-6xl",
  narrow: "max-w-3xl",
};

const cardLevelClasses: Record<WorkspaceCardLevel, string> = {
  1: "ui-panel",
  2: "ui-surface",
  3: "ui-surface-muted",
};

/** Canonical authenticated customer shell. Route layouts should use this instead of assembling navigation. */
export function AppShell({ children, role, enabledFeatureFlags, entitlements }: Readonly<{ children: ReactNode; role?: string | null; enabledFeatureFlags?: readonly string[]; entitlements?: readonly string[] }>) {
  return <ClientWorkspaceShell role={role} enabledFeatureFlags={enabledFeatureFlags} entitlements={entitlements}>{children}</ClientWorkspaceShell>;
}

/** Canonical content container. The platform shell already owns the document's main landmark. */
export function WorkspacePage({ children, width = "wide", className, ...props }: HTMLAttributes<HTMLDivElement> & Readonly<{ width?: WorkspaceWidth }>) {
  return <div data-als="workspace-page" className={cn("mx-auto w-full px-4 py-8 sm:px-6 lg:px-8 lg:py-12", widthClasses[width], className)} {...props}>{children}</div>;
}

export function WorkspaceHeader({
  title,
  description,
  eyebrow,
  actions,
  context,
  className,
}: Readonly<{ title: string; description: string; eyebrow?: string; actions?: ReactNode; context?: ReactNode; className?: string }>) {
  return (
    <header data-als="workspace-header" className={cn("flex flex-col justify-between gap-4 pb-3 lg:flex-row lg:items-center", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="ui-capability">{eyebrow}</p> : null}
        <h1 className="sr-only">{title}</h1>
        <p className="mt-1 max-w-3xl text-xs text-stone-600">{description}</p>
      </div>
      {actions || context ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center">{context}{actions}</div> : null}
    </header>
  );
}

export function WorkspaceContextSelector({ label, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & Readonly<{ label: string }>) {
  return (
    <label className={cn("block", className)}>
      <span className="sr-only">{label}</span>
      <select aria-label={label} className="ui-control rounded-full px-4 text-sm font-semibold" {...props}>{children}</select>
    </label>
  );
}

export function WorkspaceNavigation({label,items,activeHref,action}:{label:string;items:readonly Readonly<{label:string;href:string}>[];activeHref:string;action?:ReactNode}){return <div className="overflow-x-auto border-b border-stone-200 bg-white px-4 sm:px-6 lg:px-8"><div className="mx-auto flex min-w-max max-w-[1440px] items-center justify-between gap-8"><nav aria-label={label} className="flex gap-8">{items.map(item=>{const active=activeHref===item.href;return <Link key={item.href} href={item.href} aria-current={active?"page":undefined} className={cn("border-b-2 py-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-teal-600",active?"border-stone-950 text-stone-950":"border-transparent text-stone-500 hover:text-stone-950")}>{item.label}</Link>})}</nav>{action?<div className="shrink-0 py-2">{action}</div>:null}</div></div>}
export function StepWizard({label,steps,current}:{label:string;steps:readonly string[];current:number}){return <nav aria-label={label}><ol className="grid gap-2 sm:grid-cols-5">{steps.map((step,index)=><li key={step} aria-current={index===current?"step":undefined} className={cn("rounded-xl border px-3 py-3 text-sm font-semibold",index===current?"border-stone-950 bg-stone-950 text-white":index<current?"border-emerald-200 bg-emerald-50 text-emerald-800":"border-stone-200 bg-white text-stone-500")}><span className="mr-2">{index+1}</span>{step}</li>)}</ol></nav>}
export function ListDetailPattern({list,detail,className}:{list:ReactNode;detail:ReactNode;className?:string}){return <div data-als="list-detail" className={cn("grid min-h-0 gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.7fr)]",className)}><section aria-label="Items">{list}</section><section aria-label="Selected item">{detail}</section></div>}

function Region({ type, children, className, ...props }: HTMLAttributes<HTMLElement> & Readonly<{ type: "workspace-overview" | "workspace-content" | "workspace-supporting" | "workspace-activity" }>) {
  const Component = type === "workspace-supporting" ? "aside" : "section";
  return <Component data-als={type} className={cn(type === "workspace-overview" ? "mt-8" : type === "workspace-content" ? "mt-8" : "mt-12", className)} {...props}>{children}</Component>;
}

export function WorkspaceOverview(props: Omit<Parameters<typeof Region>[0], "type">) {
  return <Region type="workspace-overview" {...props} />;
}

export function WorkspaceContent(props: Omit<Parameters<typeof Region>[0], "type">) {
  return <Region type="workspace-content" {...props} />;
}

export function WorkspaceSupporting(props: Omit<Parameters<typeof Region>[0], "type">) {
  return <Region type="workspace-supporting" {...props} />;
}

export function WorkspaceActivity(props: Omit<Parameters<typeof Region>[0], "type">) {
  return <Region type="workspace-activity" {...props} />;
}

export function WorkspaceGrid({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-als="workspace-grid" className={cn("grid grid-cols-1 gap-4 md:grid-cols-6 md:gap-6 lg:grid-cols-12", className)} {...props}>{children}</div>;
}

export function WorkspaceCard({ level = 2, className, ...props }: HTMLAttributes<HTMLDivElement> & Readonly<{ level?: WorkspaceCardLevel }>) {
  return <div data-als-card-level={level} className={cn(cardLevelClasses[level], className)} {...props} />;
}

export function WorkspaceSectionHeading({ title, description, action, className }: Readonly<{ title: string; description?: string; action?: ReactNode; className?: string }>) {
  return <div className={cn("mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end", className)}><div><h2 className="ui-section-title">{title}</h2>{description ? <p className="ui-supporting mt-1">{description}</p> : null}</div>{action}</div>;
}

export function WorkspaceEmptyState({ title, description, action, icon }: Readonly<{ title: string; description: string; action?: ReactNode; icon?: ReactNode }>) {
  return <WorkspaceCard level={3} className="px-6 py-12 text-center">{icon ?? <Inbox aria-hidden="true" className="mx-auto h-7 w-7 text-stone-400" />}<h2 className="mt-4 text-base font-semibold text-stone-950">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">{description}</p>{action ? <div className="mt-5">{action}</div> : null}</WorkspaceCard>;
}

export function WorkspaceErrorState({ title, description, retry, details }: Readonly<{ title: string; description: string; retry?: () => void; details?: ReactNode }>) {
  return <WorkspaceCard level={3} role="alert" className="border-amber-200 bg-amber-50 p-6"><AlertTriangle aria-hidden="true" className="h-6 w-6 text-amber-700" /><h2 className="mt-3 font-semibold text-amber-950">{title}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-amber-900">{description}</p>{retry ? <button type="button" onClick={retry} className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-950 px-4 py-2 text-sm font-semibold text-white"><RotateCcw aria-hidden="true" className="h-4 w-4" />Try again</button> : null}{details ? <details className="mt-4 text-xs text-amber-900"><summary className="cursor-pointer font-semibold">Technical details</summary><div className="mt-2">{details}</div></details> : null}</WorkspaceCard>;
}

export function WorkspaceSkeleton({ cards = 4 }: Readonly<{ cards?: number }>) {
  return <div aria-busy="true" aria-label="Loading workspace" className="animate-pulse motion-reduce:animate-none"><div className="h-32 rounded-3xl bg-stone-200" /><span className="sr-only">Loading…</span><div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: cards }, (_, index) => <div key={index} className="h-28 rounded-2xl bg-stone-200" />)}</div><div className="mt-8 h-72 rounded-2xl bg-stone-200" /></div>;
}

export function EmptyStateAction({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white">{children}<ArrowRight aria-hidden="true" className="h-4 w-4" /></span>;
}

export function StatusChip({ children, tone = "neutral" }: Readonly<{ children: ReactNode; tone?: "healthy" | "attention" | "unavailable" | "preview" | "neutral" }>) {
  const tones = {
    healthy: "border-emerald-200 bg-emerald-50 text-emerald-800",
    attention: "border-amber-200 bg-amber-50 text-amber-900",
    unavailable: "border-stone-300 bg-stone-100 text-stone-700",
    preview: "border-violet-200 bg-violet-50 text-violet-800",
    neutral: "border-stone-200 bg-white text-stone-700",
  };
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function HelpTooltip({ label, children }: Readonly<{ label: string; children: ReactNode }>) {
  return <span className="group/help relative inline-flex align-middle"><button type="button" aria-label={`About ${label}`} className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-stone-400 outline-none hover:bg-stone-100 hover:text-stone-700 focus-visible:ring-2 focus-visible:ring-teal-600"><CircleHelp aria-hidden="true" className="h-4 w-4" /></button><span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 hidden w-64 -translate-x-1/2 rounded-xl bg-stone-950 px-3 py-2 text-left text-xs font-normal leading-5 text-white shadow-xl group-hover/help:block group-focus-within/help:block">{children}</span></span>;
}

export function ExpandablePanel({ title, summary, children }: Readonly<{ title: string; summary: string; children: ReactNode }>) {
  return <details className="group rounded-2xl border border-stone-200 bg-white p-5"><summary className="cursor-pointer list-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-teal-600"><span className="font-semibold text-stone-950">{title}</span><span className="mt-1 block text-sm text-stone-600">{summary}</span><span className="mt-3 block text-xs font-semibold text-teal-800 group-open:hidden">Show details</span><span className="mt-3 hidden text-xs font-semibold text-teal-800 group-open:block">Hide details</span></summary><div className="mt-4 border-t border-stone-200 pt-4">{children}</div></details>;
}

export function WorkspacePlaceholder({ title, description, label = "Preview" }: Readonly<{ title: string; description: string; label?: "Preview" | "Coming Soon" | "Needs Connection" | "Needs Data" }>) {
  return <WorkspaceCard level={3} aria-disabled="true" className="border-dashed p-6"><StatusChip tone="preview">{label}</StatusChip><h2 className="mt-4 font-semibold text-stone-950">{title}</h2><p className="mt-2 text-sm leading-6 text-stone-600">{description}</p></WorkspaceCard>;
}
