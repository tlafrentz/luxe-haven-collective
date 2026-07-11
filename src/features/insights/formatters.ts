import type { MetricFormat } from "./types"

export function formatMetricValue(
  value: number,
  format: MetricFormat,
): string {
  switch (format) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value)

    case "percentage":
      return `${value}%`

    case "rating":
      return value.toFixed(2)

    case "decimal":
    default:
      return value.toLocaleString("en-US")
  }
}

export function calculateDifference(
  propertyValue: number,
  marketValue: number,
): number {
  if (marketValue === 0) {
    return 0
  }

  return ((propertyValue - marketValue) / marketValue) * 100
}
