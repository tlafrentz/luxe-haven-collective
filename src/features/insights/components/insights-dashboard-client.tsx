"use client"

import { useMemo, useState } from "react"

import type {
  DateRangeValue,
  LuxeInsightsData,
} from "../types"

import { InsightsControls } from "./insights-controls"
import { MarketComparison } from "./market-comparison"
import { MetricGrid } from "./metric-grid"
import { OccupancyHeatmap } from "./occupancy-heatmap"
import { PerformanceChart } from "./performance-chart"
import { PerformanceScoreCard } from "./performance-score-card"
import { Recommendations } from "./recommendations"

interface InsightsDashboardClientProps {
  data: LuxeInsightsData
}

export function InsightsDashboardClient({
  data,
}: InsightsDashboardClientProps) {
  const [selectedPropertyId, setSelectedPropertyId] =
    useState(data.property.id)

  const [dateRange, setDateRange] =
    useState<DateRangeValue>("30d")

  const selectedProperty = useMemo(
    () =>
      data.availableProperties.find(
        (property) => property.id === selectedPropertyId,
      ) ?? data.property,
    [data.availableProperties, data.property, selectedPropertyId],
  )

  const dateRangeLabel: Record<DateRangeValue, string> = {
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
    "1y": "Last year",
  }

  return (
    <main>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
              Luxe Insights
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
              {selectedProperty.name}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone-500">
              <span>{selectedProperty.location}</span>
              <span aria-hidden="true">•</span>
              <span>{data.lastUpdatedLabel}</span>
            </div>
          </div>

          <InsightsControls
            properties={data.availableProperties}
            selectedPropertyId={selectedPropertyId}
            dateRange={dateRange}
            onPropertyChange={setSelectedPropertyId}
            onDateRangeChange={setDateRange}
          />
        </header>

        <div className="mt-8 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600 shadow-sm">
          Showing performance for{" "}
          <span className="font-semibold text-stone-950">
            {dateRangeLabel[dateRange]}
          </span>
        </div>

        <div className="mt-6 space-y-6">
          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <MetricGrid metrics={data.metrics} />

            <PerformanceScoreCard
              score={data.performanceScore}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.45fr_0.55fr]">
            <PerformanceChart data={data.performance} />

            <OccupancyHeatmap data={data.occupancyByDay} />
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <MarketComparison
              comparisons={data.marketComparisons}
            />

            <Recommendations
              recommendations={data.recommendations}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
