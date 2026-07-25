import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { ArrowRight, CircleDashed, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SurfaceKind = "primary" | "secondary" | "informational" | "status" | "preview";
export type SemanticTone = "neutral" | "success" | "warning" | "critical" | "information" | "preview";

const surfaces: Record<SurfaceKind, string> = {
  primary: "ui-panel",
  secondary: "ui-surface",
  informational: "ui-surface-muted",
  status: "ui-surface",
  preview: "ui-surface-muted border-dashed",
};

const tones: Record<SemanticTone, string> = {
  neutral: "border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--status-neutral-fg)]",
  success: "border-[var(--status-positive-border)] bg-[var(--status-positive-bg)] text-[var(--status-positive-fg)]",
  warning: "border-[var(--status-attention-border)] bg-[var(--status-attention-bg)] text-[var(--status-attention-fg)]",
  critical: "border-[var(--status-critical-border)] bg-[var(--status-critical-bg)] text-[var(--status-critical-fg)]",
  information: "border-[var(--status-information-border)] bg-[var(--status-information-bg)] text-[var(--status-information-fg)]",
  preview: "border-[var(--status-neutral-border)] bg-[var(--status-neutral-bg)] text-[var(--text-secondary)]",
};

export function SurfaceCard({ kind = "secondary", className, ...props }: HTMLAttributes<HTMLElement> & Readonly<{ kind?: SurfaceKind }>) {
  return <article className={cn(surfaces[kind], "p-6", className)} {...props} />;
}

export function SectionHeader({ capability, title, description, action }: Readonly<{ capability?: string; title: string; description?: string; action?: ReactNode }>) {
  return <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div>{capability ? <p className="ui-capability">{capability}</p> : null}<h2 className="ui-section-title mt-1">{title}</h2>{description ? <p className="ui-supporting mt-1 max-w-3xl">{description}</p> : null}</div>{action}</header>;
}

export function SemanticBadge({ children, tone = "neutral" }: Readonly<{ children: ReactNode; tone?: SemanticTone }>) {
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export const Chip = SemanticBadge;

export function MetricTile({ label, value, supporting, icon: Icon, badge }: Readonly<{ label: string; value: ReactNode; supporting?: ReactNode; icon?: LucideIcon; badge?: ReactNode }>) {
  return <SurfaceCard className="min-w-0"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p><p className="ui-metric mt-3 break-words">{value}</p></div>{Icon ? <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]"><Icon aria-hidden="true" className="h-5 w-5" /></span> : null}</div>{badge ? <div className="mt-3">{badge}</div> : null}{supporting ? <div className="ui-supporting mt-3">{supporting}</div> : null}</SurfaceCard>;
}

export const MetricCard = MetricTile;
export const SummaryCard = SurfaceCard;
export const InsightCard = SurfaceCard;
export const DecisionCard = SurfaceCard;
export const EvidenceCard = SurfaceCard;
export const StatusCard = SurfaceCard;

export function PlaceholderCard({ title, description, label = "Preview" }: Readonly<{ title: string; description: string; label?: string }>) {
  return <SurfaceCard kind="preview" aria-disabled="true"><SemanticBadge tone="preview">{label}</SemanticBadge><h3 className="ui-card-title mt-4">{title}</h3><p className="ui-supporting mt-2">{description}</p></SurfaceCard>;
}

export function EmptyState({ title, description, action, icon: Icon = CircleDashed }: Readonly<{ title: string; description: string; action?: ReactNode; icon?: LucideIcon }>) {
  return <SurfaceCard kind="informational" role="status" className="px-6 py-12 text-center"><Icon aria-hidden="true" className="mx-auto h-7 w-7 text-[var(--text-muted)]" /><h3 className="ui-card-title mt-4">{title}</h3><p className="ui-supporting mx-auto mt-2 max-w-md">{description}</p>{action ? <div className="mt-5">{action}</div> : null}</SurfaceCard>;
}

export function PrimaryButton({ children, className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn("ui-button inline-flex items-center justify-center gap-2 bg-[var(--brand-primary)] px-5 text-sm font-semibold text-[var(--primary-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-[var(--opacity-disabled)]", className)} {...props}>{children}</button>;
}

export function TextAction({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--text-link)]">{children}<ArrowRight aria-hidden="true" className="h-4 w-4" /></span>;
}
