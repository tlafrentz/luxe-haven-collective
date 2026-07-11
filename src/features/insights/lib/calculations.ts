import type {
  InsightMetric,
  PerformanceDataPoint,
} from "../types"

export function calculateRevenue(
  performance: PerformanceDataPoint[],
) {
  return performance.reduce(
    (total, month) => total + month.revenue,
    0,
  )
}

export function calculateAverageOccupancy(
  performance: PerformanceDataPoint[],
) {
  if (!performance.length) return 0

  const total = performance.reduce(
    (sum, month) => sum + month.occupancy,
    0,
  )

  return Math.round(total / performance.length)
}

export function metricById(
  metrics: InsightMetric[],
  id: string,
) {
  return metrics.find((metric) => metric.id === id)
}
