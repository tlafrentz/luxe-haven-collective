import { Sparkles } from "lucide-react";

import type { AnalyticsRecommendation } from "../types";

import { RecommendationCard } from "./recommendation-card";

type RevenueIntelligenceProps = {
  recommendations: AnalyticsRecommendation[];
};

export function RevenueIntelligence({
  recommendations,
}: RevenueIntelligenceProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-950 text-white">
              <Sparkles
                aria-hidden="true"
                className="h-4 w-4"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-neutral-500">
                Revenue intelligence
              </p>

              <h2 className="mt-0.5 text-xl font-semibold text-neutral-950">
                Recommended actions
              </h2>
            </div>
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
            Recommendations generated from live booking,
            revenue, occupancy, pricing, and payment data.
          </p>
        </div>

        <div className="w-fit rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600">
          {recommendations.length}{" "}
          {recommendations.length === 1
            ? "recommendation"
            : "recommendations"}
        </div>
      </div>

      {recommendations.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
          <h3 className="text-sm font-semibold text-neutral-950">
            No recommendations available
          </h3>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
            Expand the reporting period or select a property
            with more reservation history.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {recommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              recommendation={recommendation}
            />
          ))}
        </div>
      )}
    </section>
  );
}
