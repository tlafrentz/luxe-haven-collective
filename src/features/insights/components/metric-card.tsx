import { formatMetricValue } from "../lib/formatters"
import type { InsightMetric } from "../types"

interface MetricCardProps {
  metric: InsightMetric
}

function TrendArrow({ trend }: Pick<InsightMetric, "trend">) {
  if (trend === "neutral") {
    return <span aria-hidden="true">—</span>
  }

  return <span aria-hidden="true">{trend === "up" ? "↗" : "↘"}</span>
}

export function MetricCard({ metric }: MetricCardProps) {
  const positive = metric.trend === "up"
  const negative = metric.trend === "down"

  return (
    <article className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <p className="text-sm font-medium text-stone-500">{metric.label}</p>

      <div className="mt-3 flex items-end justify-between gap-4">
        <p className="text-3xl font-semibold tracking-tight text-stone-950">
          {formatMetricValue(metric.value, metric.format)}
        </p>

        <span
          className={[
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
            positive ? "bg-emerald-50 text-emerald-700" : "",
            negative ? "bg-rose-50 text-rose-700" : "",
            metric.trend === "neutral"
              ? "bg-stone-100 text-stone-600"
              : "",
          ].join(" ")}
        >
          <TrendArrow trend={metric.trend} />
          {Math.abs(metric.change)}%
        </span>
      </div>

      <p className="mt-3 text-xs leading-5 text-stone-500">
        {metric.comparisonLabel}
      </p>
    </article>
  )
}
