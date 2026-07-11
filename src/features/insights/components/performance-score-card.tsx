import { Card } from "@/components/ui/card"
import type { PerformanceScore } from "../types"

interface PerformanceScoreCardProps {
  score: PerformanceScore
}

export function PerformanceScoreCard({
  score,
}: PerformanceScoreCardProps) {
  const circumference = 2 * Math.PI * 44
  const progress =
    circumference - (score.score / 100) * circumference

  return (
    <Card className="flex flex-col justify-between p-6">
      <div>
        <p className="text-sm font-medium text-stone-500">
          Overall performance
        </p>

        <h2 className="mt-1 text-xl font-semibold text-stone-950">
          Property score
        </h2>
      </div>

      <div className="mt-8 flex items-center gap-6">
        <div className="relative h-28 w-28 shrink-0">
          <svg
            viewBox="0 0 100 100"
            className="-rotate-90"
            role="img"
            aria-label={`Performance score ${score.score} out of 100`}
          >
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-stone-100"
            />

            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={progress}
              className="text-stone-950"
            />
          </svg>

          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-semibold text-stone-950">
              {score.score}
            </span>
          </div>
        </div>

        <div>
          <p className="text-lg font-semibold text-stone-950">
            {score.label}
          </p>

          <p className="mt-2 text-sm leading-6 text-stone-500">
            Top {score.percentile}% of comparable properties in the{" "}
            {score.marketName}.
          </p>
        </div>
      </div>
    </Card>
  )
}
