import {
  calculateDifference,
  formatMetricValue,
} from "../formatters"
import type { MarketComparison as MarketComparisonType } from "../types"

interface MarketComparisonProps {
  comparisons: MarketComparisonType[]
}

export function MarketComparison({
  comparisons,
}: MarketComparisonProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 px-5 py-5 sm:px-6">
        <p className="text-sm font-medium text-stone-500">
          Competitive positioning
        </p>
        <h2 className="mt-1 text-xl font-semibold text-stone-950">
          Market comparison
        </h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-left">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-6 py-4 font-semibold">Metric</th>
              <th className="px-6 py-4 font-semibold">Your property</th>
              <th className="px-6 py-4 font-semibold">Mesa market</th>
              <th className="px-6 py-4 font-semibold">Difference</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-stone-100">
            {comparisons.map((comparison) => {
              const difference = calculateDifference(
                comparison.propertyValue,
                comparison.marketValue,
              )

              return (
                <tr key={comparison.id}>
                  <td className="px-6 py-5 font-medium text-stone-900">
                    {comparison.label}
                  </td>

                  <td className="px-6 py-5 text-stone-700">
                    {formatMetricValue(
                      comparison.propertyValue,
                      comparison.format,
                    )}
                  </td>

                  <td className="px-6 py-5 text-stone-500">
                    {formatMetricValue(
                      comparison.marketValue,
                      comparison.format,
                    )}
                  </td>

                  <td className="px-6 py-5">
                    <span
                      className={[
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                        difference >= 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700",
                      ].join(" ")}
                    >
                      {difference >= 0 ? "+" : ""}
                      {difference.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
