import type {
  InsightRecommendation,
  RecommendationPriority,
} from "../types"

interface RecommendationsProps {
  recommendations: InsightRecommendation[]
}

const priorityLabels: Record<RecommendationPriority, string> = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
}

const priorityClasses: Record<RecommendationPriority, string> = {
  high: "bg-rose-50 text-rose-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-stone-100 text-stone-600",
}

export function Recommendations({
  recommendations,
}: RecommendationsProps) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-stone-950 p-5 text-white shadow-sm sm:p-6">
      <div>
        <p className="text-sm font-medium text-stone-400">
          Luxe intelligence
        </p>
        <h2 className="mt-1 text-xl font-semibold">
          Recommended actions
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">
          Prioritized opportunities based on current property and
          market performance.
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {recommendations.map((recommendation, index) => (
          <article
            key={recommendation.id}
            className="rounded-xl border border-white/10 bg-white/[0.06] p-5"
          >
            <div className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-sm font-semibold text-stone-950">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <h3 className="font-semibold text-white">
                    {recommendation.title}
                  </h3>

                  <span
                    className={[
                      "w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                      priorityClasses[recommendation.priority],
                    ].join(" ")}
                  >
                    {priorityLabels[recommendation.priority]}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-6 text-stone-300">
                  {recommendation.description}
                </p>

                {recommendation.estimatedImpact ? (
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
                    Estimated impact: {recommendation.estimatedImpact}
                  </p>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
