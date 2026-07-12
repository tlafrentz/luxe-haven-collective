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
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    line: "bg-emerald-500",
  },
  blue: {
    icon: "bg-blue-50 text-blue-700 ring-blue-100",
    line: "bg-blue-500",
  },
  amber: {
    icon: "bg-amber-50 text-amber-700 ring-amber-100",
    line: "bg-amber-500",
  },
  violet: {
    icon: "bg-violet-50 text-violet-700 ring-violet-100",
    line: "bg-violet-500",
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
    <article className="group relative min-h-48 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div
        aria-hidden="true"
        className={`absolute inset-x-0 top-0 h-1 ${styles.line}`}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            {title}
          </p>

          <p className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950">
            {value}
          </p>
        </div>

        {icon ? (
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-105 ${styles.icon}`}
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

      <p className="mt-3 text-sm leading-5 text-neutral-500">
        {description}
      </p>
    </article>
  );
}
