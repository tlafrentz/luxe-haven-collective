import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";

import type {
  MetricTrend,
} from "@/features/analytics";

type MetricTrendProps = {
  trend: MetricTrend | null;
  suffix?: string;
};

export function MetricTrend({
  trend,
  suffix = "%",
}: MetricTrendProps) {
  if (!trend) {
    return (
      <span className="text-xs text-stone-400">
        No comparison
      </span>
    );
  }

  const value = Math.abs(trend.percentChange).toFixed(1);

  if (trend.direction === "up") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
        <ArrowUpRight className="h-3.5 w-3.5" />
        {value}
        {suffix}
      </span>
    );
  }

  if (trend.direction === "down") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
        <ArrowDownRight className="h-3.5 w-3.5" />
        {value}
        {suffix}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-stone-500">
      <ArrowRight className="h-3.5 w-3.5" />
      No change
    </span>
  );
}
