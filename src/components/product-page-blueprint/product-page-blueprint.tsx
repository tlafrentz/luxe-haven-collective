"use client";

import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle, Archive, Ban, CircleAlert, LockKeyhole, SearchX, TriangleAlert } from "lucide-react";

import {
  WorkspaceActivity,
  WorkspaceContent,
  WorkspaceHeader,
  WorkspaceOverview,
  WorkspacePage,
  WorkspaceSupporting,
} from "@/components/application-layout";
import { cn } from "@/lib/utils";

export type ProductWorkspacePattern = "workbench" | "master-detail" | "guided-flow" | "dashboard-to-detail" | "settings-sections";
export type ProductDensity = "comfortable" | "standard" | "dense";
export type ProductHealthStatus = "healthy" | "attention" | "degraded" | "inactive";
export type ProductPageState = "first-use" | "healthy" | "attention" | "degraded" | "empty-result" | "loading" | "error" | "permission" | "archived";

export function ProductPage({ pattern, density = "standard", children, ...props }: ComponentProps<typeof WorkspacePage> & Readonly<{ pattern: ProductWorkspacePattern; density?: ProductDensity }>) {
  return <WorkspacePage data-ppb="product-page" data-workspace-pattern={pattern} data-density={density} {...props}>{children}</WorkspacePage>;
}

export function ProductHeader(props: ComponentProps<typeof WorkspaceHeader>) {
  return <WorkspaceHeader {...props} />;
}

export function ProductOverview(props: ComponentProps<typeof WorkspaceOverview>) {
  return <WorkspaceOverview data-ppb-region="overview" {...props} />;
}

export function ProductWorkspace(props: ComponentProps<typeof WorkspaceContent>) {
  return <WorkspaceContent data-ppb-region="primary-workspace" {...props} />;
}

export function ProductSupport(props: ComponentProps<typeof WorkspaceSupporting>) {
  return <WorkspaceSupporting data-ppb-region="support" {...props} />;
}

export function ProductActivity(props: ComponentProps<typeof WorkspaceActivity>) {
  return <WorkspaceActivity data-ppb-region="activity" {...props} />;
}

export function ProductTabs({ label, items, activeId, onSelect, className }: Readonly<{ label: string; items: readonly Readonly<{ id: string; label: string; count?: number }>[]; activeId: string; onSelect: (id: string) => void; className?: string }>) {
  return <nav aria-label={label} className={cn("overflow-x-auto border-b border-stone-200", className)}><div className="flex min-w-max gap-1">{items.map((item) => <button key={item.id} type="button" onClick={() => onSelect(item.id)} aria-current={activeId === item.id ? "page" : undefined} className={cn("border-b-2 px-4 py-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600", activeId === item.id ? "border-teal-700 text-teal-800" : "border-transparent text-stone-500 hover:text-stone-900")}>{item.label}{item.count !== undefined ? <span className="ml-2 text-xs text-stone-400">{item.count}</span> : null}</button>)}</div></nav>;
}

export function ProductSectionNav({ label, items, activeId, onSelect }: Readonly<{ label: string; items: readonly Readonly<{ id: string; label: string; description?: string }>[]; activeId: string; onSelect: (id: string) => void }>) {
  return <nav aria-label={label} className="space-y-1">{items.map((item) => <button key={item.id} type="button" onClick={() => onSelect(item.id)} aria-current={activeId === item.id ? "page" : undefined} className={cn("w-full rounded-xl px-3 py-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-teal-600", activeId === item.id ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-100")}><span className="block text-sm font-semibold">{item.label}</span>{item.description ? <span className={cn("mt-1 block text-xs", activeId === item.id ? "text-stone-300" : "text-stone-500")}>{item.description}</span> : null}</button>)}</nav>;
}

export function ProductStepNav({ label, steps, current }: Readonly<{ label: string; steps: readonly string[]; current: number }>) {
  return <nav aria-label={label}><ol className="flex overflow-x-auto">{steps.map((step, index) => { const number = index + 1; const status = number < current ? "complete" : number === current ? "current" : "upcoming"; return <li key={step} aria-current={status === "current" ? "step" : undefined} className="flex min-w-32 flex-1 items-center gap-2 border-b-2 border-stone-200 px-3 py-3 text-xs font-semibold text-stone-500 data-[status=current]:border-teal-700 data-[status=current]:text-teal-800" data-status={status}><span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", status === "complete" ? "bg-teal-700 text-white" : status === "current" ? "border border-teal-700 text-teal-800" : "border border-stone-300")}>{number}</span>{step}</li>; })}</ol></nav>;
}

const healthStyles: Record<ProductHealthStatus, string> = {
  healthy: "border-teal-200 bg-teal-50 text-teal-950",
  attention: "border-amber-200 bg-amber-50 text-amber-950",
  degraded: "border-orange-200 bg-orange-50 text-orange-950",
  inactive: "border-stone-200 bg-stone-50 text-stone-800",
};

export function HealthSummary({ label, children, className }: Readonly<{ label: string; children: ReactNode; className?: string }>) {
  return <div role="group" aria-label={label} className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>{children}</div>;
}

export function HealthIndicator({ label, status, value, evidence, interpretation, action }: Readonly<{ label: string; status: ProductHealthStatus; value: string; evidence: string; interpretation: string; action?: ReactNode }>) {
  return <article className={cn("rounded-2xl border p-5", healthStyles[status])}><div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">{label}</h3><span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-semibold capitalize">{status}</span></div><p className="mt-3 text-xl font-semibold">{value}</p><p className="mt-3 text-xs leading-5 opacity-75">{evidence}</p><p className="mt-2 text-xs font-semibold leading-5">{interpretation}</p>{action ? <div className="mt-4">{action}</div> : null}</article>;
}

const stateContent: Record<Exclude<ProductPageState, "healthy" | "loading" | "error">, Readonly<{ icon: typeof CircleAlert; tone: string; defaultTitle: string }>> = {
  "first-use": { icon: CircleAlert, tone: "border-stone-200 bg-stone-50 text-stone-800", defaultTitle: "Get started" },
  attention: { icon: AlertTriangle, tone: "border-amber-200 bg-amber-50 text-amber-950", defaultTitle: "Attention needed" },
  degraded: { icon: TriangleAlert, tone: "border-orange-200 bg-orange-50 text-orange-950", defaultTitle: "Some information is unavailable" },
  "empty-result": { icon: SearchX, tone: "border-stone-200 bg-stone-50 text-stone-800", defaultTitle: "No matching results" },
  permission: { icon: LockKeyhole, tone: "border-blue-200 bg-blue-50 text-blue-950", defaultTitle: "Access restricted" },
  archived: { icon: Archive, tone: "border-stone-300 bg-stone-100 text-stone-800", defaultTitle: "Archived" },
};

export function ProductState({ state, title, description, consequence, action, className }: Readonly<{ state: Exclude<ProductPageState, "healthy" | "loading" | "error">; title?: string; description: string; consequence?: string; action?: ReactNode; className?: string }>) {
  const model = stateContent[state];
  const Icon = model.icon;
  return <section data-product-state={state} className={cn("rounded-2xl border p-6", model.tone, className)}><Icon aria-hidden="true" className="h-6 w-6" /><h2 className="mt-3 font-semibold">{title ?? model.defaultTitle}</h2><p className="mt-2 max-w-xl text-sm leading-6 opacity-80">{description}</p>{consequence ? <p className="mt-2 max-w-xl text-sm font-semibold leading-6">{consequence}</p> : null}{action ? <div className="mt-5">{action}</div> : null}</section>;
}

export function PermissionState({ description, action }: Readonly<{ description: string; action?: ReactNode }>) {
  return <ProductState state="permission" description={description} action={action} />;
}

export function DegradedState({ description, consequence, action }: Readonly<{ description: string; consequence: string; action?: ReactNode }>) {
  return <ProductState state="degraded" description={description} consequence={consequence} action={action} />;
}

export function AttentionState({ title, description, consequence, action }: Readonly<{ title?: string; description: string; consequence: string; action?: ReactNode }>) {
  return <ProductState state="attention" title={title} description={description} consequence={consequence} action={action} />;
}

export function ArchivedState({ description, restoreAction }: Readonly<{ description: string; restoreAction?: ReactNode }>) {
  return <ProductState state="archived" description={description} action={restoreAction} />;
}

export function UnavailableActionExplanation({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="inline-flex items-center gap-2 text-xs text-stone-500"><Ban aria-hidden="true" className="h-3.5 w-3.5" />{children}</span>;
}

export function ActivityTimeline({ label, items }: Readonly<{ label: string; items: readonly Readonly<{ id: string; title: string; metadata: string; result?: string }>[] }>) {
  return <ol aria-label={label} className="space-y-0">{items.map((item) => <li key={item.id} className="relative border-l border-stone-200 pb-6 pl-6 last:pb-0"><span aria-hidden="true" className="absolute -left-1.5 top-1 h-3 w-3 rounded-full border-2 border-white bg-teal-700" /><p className="text-sm font-semibold text-stone-900">{item.title}</p><p className="mt-1 text-xs text-stone-500">{item.metadata}</p>{item.result ? <p className="mt-2 text-xs leading-5 text-stone-600">{item.result}</p> : null}</li>)}</ol>;
}
