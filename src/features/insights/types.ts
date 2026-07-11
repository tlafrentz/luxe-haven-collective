export type MetricFormat =
  | "currency"
  | "percentage"
  | "decimal"
  | "rating"

export type MetricTrend = "up" | "down" | "neutral"

export type RecommendationPriority = "high" | "medium" | "low"

export interface InsightMetric {
  id: string
  label: string
  value: number
  format: MetricFormat
  change: number
  trend: MetricTrend
  comparisonLabel: string
}

export interface PerformanceDataPoint {
  label: string
  revenue: number
  occupancy: number
}

export interface MarketComparison {
  id: string
  label: string
  propertyValue: number
  marketValue: number
  format: MetricFormat
}

export interface InsightRecommendation {
  id: string
  title: string
  description: string
  priority: RecommendationPriority
  estimatedImpact?: string
}

export interface LuxeInsightsData {
  property: {
    id: string
    name: string
    location: string
  }
  periodLabel: string
  metrics: InsightMetric[]
  performance: PerformanceDataPoint[]
  marketComparisons: MarketComparison[]
  recommendations: InsightRecommendation[]
}
