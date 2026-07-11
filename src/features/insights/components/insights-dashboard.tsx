import type { LuxeInsightsData } from "../types"
import { MarketComparison } from "./market-comparison"
import { MetricGrid } from "./metric-grid"
import { PerformanceChart } from "./performance-chart"
import { Recommendations } from "./recommendations"

interface InsightsDashboardProps {
  data: LuxeInsightsData
}

export function InsightsDashboard({
  data,
}: InsightsDashboardProps) {
  return (
    <main className="min-h-screen bg-[#f8f7f4]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
              Luxe Insights
            </p>

            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
              {data.property.name}
            </h1>

            <p className="mt-2 text-sm text-stone-500">
              {data.property.location}
            </p>
          </div>

          <div className="w-fit rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-sm">
            {data.periodLabel}
          </div>
        </header>

        <div className="space-y-6">
          <MetricGrid metrics={data.metrics} />

          <PerformanceChart data={data.performance} />

          <div className="grid items-start gap-6 xl:grid-cols-[1.15fr_0.85fr]">
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
