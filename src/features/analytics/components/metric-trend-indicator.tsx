import {
  ArrowDown,
  ArrowUp,
  Minus,
} from "lucide-react";

import type { MetricTrend } from "../types";

type MetricTrendIndicatorProps = {
  trend: MetricTrend;
  label?: string;
};

export function MetricTrendIndicator({
  trend,
  label = "vs previous period",
}: MetricTrendIndicatorProps) {
  const Icon =
    trend.direction === "up"
      ? ArrowUp
      : trend.direction === "down"
        ? ArrowDown
        : Minus;

  const directionClasses =
    trend.direction === "up"
      ? "text-emerald-700"
      : trend.direction === "down"
        ? "text-red-700"
        : "text-neutral-600";

  const formattedChange = `${Math.abs(
    trend.percentChange,
  ).toFixed(1)}%`;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <span
        className={`inline-flex items-center gap-1 font-medium ${directionClasses}`}
      >
        <Icon
          aria-hidden="true"
          className="h-4 w-4"
        />

        {formattedChange}
      </span>

      <span className="text-neutral-500">
        {label}
      </span>
    </div>
  );
}
