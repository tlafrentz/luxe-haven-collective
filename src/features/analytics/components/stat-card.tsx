import type { ReactNode } from "react";

import type { MetricTrend as MetricTrendData } from "../types";

import { MetricTrendIndicator } from "./metric-trend-indicator";

type StatCardAccent =
  | "emerald"
  | "blue"
  | "amber"
  | "violet";

type StatCardProps = {
  title: string;
  value: string;
  description: string;
  icon?: ReactNode;
  trend?: MetricTrendData;
  trendLabel?: string;
  accent?: StatCardAccent;
};

const accentStyles: Record<
  StatCardAccent,
  {
    icon: string;
    line: string;
  }
> = {
  emerald: {
    icon: "bg-[var(--surface-subtle)] text-[var(--text-link)] ring-[var(--border-subtle)]",
    line: "bg-[var(--border-focus)]",
  },
  blue: {
    icon: "bg-[var(--surface-subtle)] text-[var(--text-link)] ring-[var(--border-subtle)]",
    line: "bg-[var(--border-focus)]",
  },
  amber: {
    icon: "bg-[var(--surface-subtle)] text-[var(--text-link)] ring-[var(--border-subtle)]",
    line: "bg-[var(--border-focus)]",
  },
  violet: {
    icon: "bg-[var(--surface-subtle)] text-[var(--text-link)] ring-[var(--border-subtle)]",
    line: "bg-[var(--border-focus)]",
  },
};

export function StatCard({
  title,
  value,
  description,
  icon,
  trend,
  trendLabel,
  accent = "blue",
}: StatCardProps) {
  const styles = accentStyles[accent];

  return (
    <article className="ui-surface group relative min-h-48 overflow-hidden p-5 transition-[border-color,box-shadow] duration-[var(--duration-standard)] hover:border-[var(--border-default)] hover:shadow-[var(--shadow-interactive)]">

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">
            {title}
          </p>

          <p className="ui-metric mt-3">
            {value}
          </p>
        </div>

        {icon ? (
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${styles.icon}`}
          >
            {icon}
          </div>
        ) : null}
      </div>

      {trend ? (
<MetricTrendIndicator
  trend={trend}
  label={trendLabel}
/>
      ) : null}

      <p className="ui-supporting mt-3">
        {description}
      </p>
    </article>
  );
}
