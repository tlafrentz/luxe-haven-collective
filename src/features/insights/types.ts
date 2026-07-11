export type MetricFormat =
  | "currency"
  | "percentage"
  | "decimal"
  | "rating"

export type MetricTrend = "up" | "down" | "neutral"

export type RecommendationPriority = "high" | "medium" | "low"

export type DateRangeValue = "7d" | "30d" | "90d" | "1y"

export interface InsightProperty {
  id: string
  name: string
  location: string
}

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
  adr: number
  revpar: number
  forecast?: boolean
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
  category:
    | "revenue"
    | "occupancy"
    | "listing"
    | "operations"
  title: string
  description: string
  priority: RecommendationPriority
  estimatedImpact?: string
  confidence?: number
  effort?: string
  actionLabel?: string
}

export interface OccupancyDay {
  day: string
  occupancy: number
}

export interface PerformanceScore {
  score: number
  label: string
  percentile: number
  marketName: string
}

export interface LuxeInsightsData {
  property: InsightProperty
  availableProperties: InsightProperty[]
  periodLabel: string
  lastUpdatedLabel: string
  performanceScore: PerformanceScore
  metrics: InsightMetric[]
  performance: PerformanceDataPoint[]
  occupancyByDay: OccupancyDay[]
  marketComparisons: MarketComparison[]
  recommendations: InsightRecommendation[]
}
