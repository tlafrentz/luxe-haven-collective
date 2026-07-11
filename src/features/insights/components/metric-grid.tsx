import type { InsightMetric } from "../types"
import { MetricCard } from "./metric-card"

interface MetricGridProps {
  metrics: InsightMetric[]
}

export function MetricGrid({ metrics }: MetricGridProps) {
  return (
    <section
      aria-label="Property performance metrics"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {metrics.map((metric) => (
        <MetricCard key={metric.id} metric={metric} />
      ))}
    </section>
  )
}
