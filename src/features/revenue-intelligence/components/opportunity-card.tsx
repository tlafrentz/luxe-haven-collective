import type {
  LucideIcon,
} from "lucide-react";

import {
  BadgeDollarSign,
  BedDouble,
  CalendarRange,
  ChartNoAxesCombined,
  CircleDollarSign,
  ClipboardCheck,
  Gauge,
  Network,
} from "lucide-react";

import type {
  OpportunityCategory,
  OpportunityConfidence,
  OpportunityEvidence,
  OpportunitySeverity,
  RevenueOpportunity,
} from "../types";

type OpportunityCardProps = {
  opportunity: RevenueOpportunity;
};

type SeverityConfig = {
  label: string;
  badge: string;
  border: string;
};

type CategoryConfig = {
  label: string;
  icon: LucideIcon;
};

const severityConfig: Record<
  OpportunitySeverity,
  SeverityConfig
> = {
  high: {
    label: "High priority",
    badge:
      "bg-red-50 text-red-700 ring-red-600/20",
    border: "border-red-200",
  },
  medium: {
    label: "Medium priority",
    badge:
      "bg-amber-50 text-amber-700 ring-amber-600/20",
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
  OpportunityConfidence,
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
  OpportunityCategory,
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
    icon: ChartNoAxesCombined,
  },
  distribution: {
    label: "Distribution",
    icon: Network,
  },
  operations: {
    label: "Operations",
    icon: ClipboardCheck,
  },
};

function formatConfidence(
  confidence: OpportunityConfidence,
): string {
  return `${confidence.charAt(0).toUpperCase()}${confidence.slice(
    1,
  )} confidence`;
}

function formatCurrency(
  value: number,
  currency = "USD",
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatEvidenceValue(
  evidence: OpportunityEvidence,
): string {
  const { value, unit } = evidence;

  if (value === null) {
    return "Not available";
  }

  if (
    unit === "currency" &&
    typeof value === "number"
  ) {
    return formatCurrency(value);
  }

  if (
    unit === "percentage" &&
    typeof value === "number"
  ) {
    return `${value.toFixed(1)}%`;
  }

  if (
    typeof value === "boolean"
  ) {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function formatDateRange(
  opportunity: RevenueOpportunity,
): string | null {
  if (!opportunity.dateRange) {
    return null;
  }

  const formatter =
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });

  const start = formatter.format(
    new Date(
      `${opportunity.dateRange.startDate}T00:00:00.000Z`,
    ),
  );

  const end = formatter.format(
    new Date(
      `${opportunity.dateRange.endDate}T00:00:00.000Z`,
    ),
  );

  return `${start} – ${end}`;
}

export function OpportunityCard({
  opportunity,
}: OpportunityCardProps) {
  const severity =
    severityConfig[opportunity.severity];

  const category =
    categoryConfig[opportunity.category];

  const CategoryIcon = category.icon;

  const dateRange =
    formatDateRange(opportunity);

  return (
    <article
      className={`rounded-2xl border bg-white p-5 shadow-sm ${severity.border}`}
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
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${severity.badge}`}
              >
                {severity.label}
              </span>

              <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700 ring-1 ring-inset ring-neutral-600/20">
                {category.label}
              </span>

              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                  confidenceStyles[
                    opportunity.confidence
                  ]
                }`}
              >
                {formatConfidence(
                  opportunity.confidence,
                )}
              </span>
            </div>

            <h3 className="mt-3 text-lg font-semibold text-neutral-950">
              {opportunity.title}
            </h3>

            <p className="mt-2 text-sm leading-6 text-neutral-600">
              {opportunity.summary}
            </p>

            {dateRange ? (
              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-neutral-500">
                <CalendarRange
                  aria-hidden="true"
                  className="h-4 w-4"
                />

                <span>{dateRange}</span>
              </div>
            ) : null}
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
              Recommended action
            </p>

            <p className="mt-1 text-sm leading-6 text-neutral-800">
              {opportunity.action.summary}
            </p>
          </div>
        </div>
      </div>

      {opportunity.impact ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <div className="flex items-start gap-3">
            <CircleDollarSign
              aria-hidden="true"
              className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"
            />

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Estimated impact
              </p>

              <p className="mt-1 text-sm font-semibold text-emerald-950">
                {typeof opportunity.impact
                  .estimatedAmount === "number"
                  ? formatCurrency(
                      opportunity.impact
                        .estimatedAmount,
                      opportunity.impact
                        .currency,
                    )
                  : opportunity.impact
                        .estimatedPercentage !==
                      undefined
                    ? `${opportunity.impact.estimatedPercentage.toFixed(
                        1,
                      )}% potential improvement`
                    : "Operational impact identified"}
              </p>

              <p className="mt-1 text-xs leading-5 text-emerald-800">
                {opportunity.impact.basis}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {opportunity.evidence.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Supporting evidence
          </p>

          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {opportunity.evidence.map(
              (item) => (
                <div
                  key={`${opportunity.id}-${item.key}`}
                  className="rounded-xl border border-neutral-200 px-3 py-3"
                >
                  <dt className="text-xs text-neutral-500">
                    {item.label}
                  </dt>

                  <dd className="mt-1 text-sm font-semibold text-neutral-950">
                    {formatEvidenceValue(item)}
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
