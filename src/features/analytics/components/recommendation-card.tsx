import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  BedDouble,
  CircleDollarSign,
  ClipboardCheck,
  CreditCard,
  Gauge,
  TrendingUp,
} from "lucide-react";

import type {
  AnalyticsRecommendation,
  RecommendationCategory,
  RecommendationConfidence,
  RecommendationPriority,
} from "../types";

type RecommendationCardProps = {
  recommendation: AnalyticsRecommendation;
};

type PriorityStyle = {
  label: string;
  badge: string;
  border: string;
};

type CategoryConfig = {
  label: string;
  icon: LucideIcon;
};

const priorityStyles: Record<
  RecommendationPriority,
  PriorityStyle
> = {
  high: {
    label: "High priority",
    badge: "bg-red-50 text-red-700 ring-red-600/20",
    border: "border-red-200",
  },
  medium: {
    label: "Medium priority",
    badge: "bg-amber-50 text-amber-700 ring-amber-600/20",
    border: "border-amber-200",
  },
  low: {
    label: "Low priority",
    badge:
      "bg-neutral-100 text-neutral-700 ring-neutral-600/20",
    border: "border-neutral-200",
  },
};

const confidenceStyles: Record<
  RecommendationConfidence,
  string
> = {
  high:
    "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  medium:
    "bg-blue-50 text-blue-700 ring-blue-600/20",
  low:
    "bg-neutral-100 text-neutral-700 ring-neutral-600/20",
};

const categoryConfig: Record<
  RecommendationCategory,
  CategoryConfig
> = {
  pricing: {
    label: "Pricing",
    icon: BadgeDollarSign,
  },
  occupancy: {
    label: "Occupancy",
    icon: BedDouble,
  },
  revenue: {
    label: "Revenue",
    icon: TrendingUp,
  },
  payments: {
    label: "Payments",
    icon: CreditCard,
  },
  operations: {
    label: "Operations",
    icon: ClipboardCheck,
  },
};

function formatConfidence(
  confidence: RecommendationConfidence,
): string {
  return `${confidence.charAt(0).toUpperCase()}${confidence.slice(
    1,
  )} confidence`;
}

export function RecommendationCard({
  recommendation,
}: RecommendationCardProps) {
  const priority =
    priorityStyles[recommendation.priority];

  const category =
    categoryConfig[recommendation.category];

  const CategoryIcon = category.icon;

  return (
    <article
      className={`rounded-2xl border bg-white p-5 shadow-sm ${priority.border}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-white">
            <CategoryIcon
              aria-hidden="true"
              className="h-5 w-5"
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${priority.badge}`}
              >
                {priority.label}
              </span>

              <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-600/20">
                {category.label}
              </span>

              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                  confidenceStyles[
                    recommendation.confidence
                  ]
                }`}
              >
                {formatConfidence(
                  recommendation.confidence,
                )}
              </span>
            </div>

            <h3 className="mt-3 text-lg font-semibold text-neutral-950">
              {recommendation.title}
            </h3>

            <p className="mt-2 text-sm leading-6 text-neutral-600">
              {recommendation.description}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-xl bg-neutral-50 p-4">
        <div className="flex items-start gap-3">
          <Gauge
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-neutral-700"
          />

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Suggested action
            </p>

            <p className="mt-1 text-sm leading-6 text-neutral-800">
              {recommendation.suggestedAction}
            </p>
          </div>
        </div>
      </div>

      {recommendation.expectedImpact ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-start gap-3">
            <CircleDollarSign
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
            />

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Expected impact
              </p>

              <p className="mt-1 text-sm leading-6 text-emerald-900">
                {recommendation.expectedImpact}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {recommendation.evidence.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Evidence
          </p>

          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendation.evidence.map(
              (item) => (
                <div
                  key={`${recommendation.id}-${item.label}`}
                  className="rounded-xl border border-neutral-200 px-3 py-3"
                >
                  <dt className="text-xs text-neutral-500">
                    {item.label}
                  </dt>

                  <dd className="mt-1 text-sm font-semibold text-neutral-950">
                    {item.value}
                  </dd>
                </div>
              ),
            )}
          </dl>
        </div>
      ) : null}
    </article>
  );
}
