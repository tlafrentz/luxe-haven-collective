import {
  Sparkles,
} from "lucide-react";

import type {
  OpportunityReport,
} from "../types";

import {
  OpportunityCard,
} from "./opportunity-card";

type OpportunityIntelligenceProps = {
  report: OpportunityReport;
};

function formatCurrency(
  value: number,
  currency: string,
): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function OpportunityIntelligence({
  report,
}: OpportunityIntelligenceProps) {
  const {
    opportunities,
    summary,
  } = report;

  return (
    <section className="rounded-2xl border border-neutral-200 bg-neutral-50/60 p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
                Priority opportunities
              </h2>
            </div>
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
            Deterministic opportunities generated from live
            booking, revenue, occupancy, payment, and
            distribution data.
          </p>
        </div>

        <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-auto">
          <SummaryPill
            label="Open opportunities"
            value={summary.total.toString()}
          />

          <SummaryPill
            label="High priority"
            value={summary.highPriority.toString()}
          />

          <SummaryPill
            label="Revenue impact"
            value={formatCurrency(
              summary.estimatedRevenueImpact,
              summary.currency,
            )}
          />
        </div>
      </div>

      {opportunities.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-10 text-center">
          <h3 className="text-sm font-semibold text-neutral-950">
            No immediate opportunities detected
          </h3>

          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-neutral-500">
            The selected reporting period did not trigger any
            current payment, cancellation, distribution,
            occupancy, gap-night, or weekend-pricing rules.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {opportunities.map(
            (opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
              />
            ),
          )}
        </div>
      )}
    </section>
  );
}

function SummaryPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <p className="text-xs font-medium text-neutral-500">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold text-neutral-950">
        {value}
      </p>
    </div>
  );
}
