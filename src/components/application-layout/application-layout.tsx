"use client";

import type { HTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { AlertTriangle, ArrowRight, Inbox, RotateCcw } from "lucide-react";

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
  1: "rounded-3xl border border-stone-200 bg-white shadow-sm",
  2: "rounded-2xl border border-stone-200 bg-white shadow-sm",
  3: "rounded-2xl border border-stone-200 bg-stone-50/70",
};

/** Canonical authenticated customer shell. Route layouts should use this instead of assembling navigation. */
export function AppShell({ children, role }: Readonly<{ children: ReactNode; role?: string | null }>) {
  return <ClientWorkspaceShell role={role}>{children}</ClientWorkspaceShell>;
}

/** Canonical content container. The platform shell already owns the document's main landmark. */
export function WorkspacePage({ children, width = "wide", className, ...props }: HTMLAttributes<HTMLDivElement> & Readonly<{ width?: WorkspaceWidth }>) {
  return <div data-als="workspace-page" className={cn("mx-auto w-full px-4 py-8 sm:px-6 lg:px-8", widthClasses[width], className)} {...props}>{children}</div>;
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
    <header data-als="workspace-header" className={cn("flex flex-col justify-between gap-6 border-b border-stone-200 pb-8 lg:flex-row lg:items-end", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700">{eyebrow}</p> : null}
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">{description}</p>
      </div>
      {actions || context ? <div className="flex flex-col gap-3 sm:flex-row sm:items-center">{context}{actions}</div> : null}
    </header>
  );
}

export function WorkspaceContextSelector({ label, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & Readonly<{ label: string }>) {
  return (
    <label className={cn("block", className)}>
      <span className="sr-only">{label}</span>
      <select aria-label={label} className="min-h-11 rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 outline-none focus-visible:ring-2 focus-visible:ring-teal-600" {...props}>{children}</select>
    </label>
  );
}

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
  return <div data-als="workspace-grid" className={cn("grid grid-cols-1 gap-6 md:grid-cols-6 lg:grid-cols-12", className)} {...props}>{children}</div>;
}

export function WorkspaceCard({ level = 2, className, ...props }: HTMLAttributes<HTMLDivElement> & Readonly<{ level?: WorkspaceCardLevel }>) {
  return <div data-als-card-level={level} className={cn(cardLevelClasses[level], className)} {...props} />;
}

export function WorkspaceSectionHeading({ title, description, action, className }: Readonly<{ title: string; description?: string; action?: ReactNode; className?: string }>) {
  return <div className={cn("mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end", className)}><div><h2 className="text-xl font-semibold text-stone-950">{title}</h2>{description ? <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p> : null}</div>{action}</div>;
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
