"use client";

import {
  useMemo,
} from "react";

import {
  AcquisitionType,
} from "../domain";

import {
  useInvestmentWorkspaceState,
} from "./investment-workspace-state";

import {
  calculateLiveInvestmentSummary,
} from "./live-investment-summary-calculations";

import type {
  LiveMetricStatus,
} from "./live-investment-summary-calculations";

function formatCurrency(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    },
  ).format(value);
}

function formatPercentage(
  value: number,
): string {
  return `${value.toFixed(1)}%`;
}

const STATUS_LABELS: Record<
  LiveMetricStatus,
  string
> = {
  healthy: "Healthy",
  caution: "Watch",
  weak: "Weak",
  neutral: "Pending",
};

const STATUS_CLASSES: Record<
  LiveMetricStatus,
  string
> = {
  healthy:
    "border-emerald-300/20 bg-emerald-300/10 text-emerald-100",
  caution:
    "border-amber-300/20 bg-amber-300/10 text-amber-100",
  weak:
    "border-rose-300/20 bg-rose-300/10 text-rose-100",
  neutral:
    "border-white/10 bg-white/[0.05] text-white/60",
};

export function LiveInvestmentSummary() {
  const {
    values,
  } = useInvestmentWorkspaceState();

  const metrics = useMemo(
    () =>
      calculateLiveInvestmentSummary(
        values,
      ),
    [values],
  );

  const strategyLabel =
    values.acquisitionType ===
    AcquisitionType.Purchase
      ? "Purchase"
      : "Rental arbitrage";

  const occupancySupportingText =
    metrics
      .breakEvenOccupancyPercentage <= 0
      ? "Add revenue assumptions"
      : metrics.occupancyMarginPercentage >= 0
        ? `${formatPercentage(
            metrics.occupancyMarginPercentage,
          )} below projected occupancy`
        : `${formatPercentage(
            Math.abs(
              metrics.occupancyMarginPercentage,
            ),
          )} above projected occupancy`;

  const metricCards = [
    {
      label: "Projected revenue",
      value: formatCurrency(
        metrics.annualRevenue,
      ),
      supportingText: "Per year",
      status: "neutral" as const,
    },
    {
      label: "Operating expenses",
      value: formatCurrency(
        metrics.annualOperatingExpenses,
      ),
      supportingText:
        values.acquisitionType ===
        AcquisitionType.Purchase
          ? "Before debt service"
          : "Includes annual lease",
      status: "neutral" as const,
    },
    {
      label: "Net operating income",
      value: formatCurrency(
        metrics.annualNoi,
      ),
      supportingText: "Before financing",
      status:
        metrics.annualNoi > 0
          ? "healthy" as const
          : "weak" as const,
    },
    {
      label: "Monthly cash flow",
      value: formatCurrency(
        metrics.monthlyCashFlow,
      ),
      supportingText:
        values.acquisitionType ===
        AcquisitionType.Purchase
          ? "After debt service"
          : "After lease payment",
      status: metrics.cashFlowStatus,
    },
    {
      label: metrics.returnLabel,
      value: formatPercentage(
        metrics.returnPercentage,
      ),
      supportingText:
        "Indicative annual return",
      status: metrics.returnStatus,
    },
    {
      label:
        metrics.secondaryReturnLabel,
      value: formatPercentage(
        metrics
          .secondaryReturnPercentage,
      ),
      supportingText:
        values.acquisitionType ===
        AcquisitionType.Purchase
          ? "NOI ÷ purchase price"
          : "NOI ÷ annual lease",
      status:
        metrics.secondaryReturnStatus,
    },
    {
      label: "Break-even occupancy",
      value: formatPercentage(
        metrics
          .breakEvenOccupancyPercentage,
      ),
      supportingText:
        occupancySupportingText,
      status: metrics.breakEvenStatus,
    },
  ] as const;

  return (
    <section
      id="underwriting-preview"
      aria-labelledby="live-investment-summary-title"
      className="scroll-mt-6 rounded-3xl border border-neutral-200 bg-neutral-950 p-6 text-white shadow-sm sm:p-7"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
            Live underwriting preview
          </p>

          <h3
            id="live-investment-summary-title"
            className="mt-2 text-xl font-semibold tracking-tight"
          >
            Indicative performance
          </h3>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            These metrics respond immediately to the current assumptions.
            Status labels are directional signals, not the final acquisition
            recommendation.
          </p>
        </div>

        <span className="w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium text-white/75">
          {strategyLabel}
        </span>
      </div>

      <dl className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map(
          ({
            label,
            value,
            supportingText,
            status,
          }) => (
            <div
              key={label}
              className="bg-neutral-950 px-4 py-5 sm:px-5"
            >
              <div className="flex items-start justify-between gap-3">
                <dt className="text-xs font-medium text-white/50">
                  {label}
                </dt>

                {status !== "neutral" ? (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${STATUS_CLASSES[status]}`}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                ) : null}
              </div>

              <dd className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {value}
              </dd>

              <p className="mt-1 text-xs leading-5 text-white/45">
                {supportingText}
              </p>
            </div>
          ),
        )}
      </dl>

      <p className="mt-4 text-xs leading-5 text-white/45">
        Healthy, watch, and weak signals use broad underwriting thresholds.
        The complete analysis adds market evidence, risk, scenarios,
        confidence, and the acquisition recommendation.
      </p>
    </section>
  );
}
