import {
  CalendarCheck2,
  CircleDollarSign,
  Hotel,
  TrendingUp,
} from "lucide-react";

import type {
  ExecutivePerformanceSummary,
} from "../domain";

import {
  MetricTrend,
} from "./metric-trend";

type PortfolioSnapshotGridProps = {
  performance: ExecutivePerformanceSummary;
};

export function PortfolioSnapshotGrid({
  performance,
}: PortfolioSnapshotGridProps) {
  const currency = new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    },
  );

  const metrics = [
    {
      label: "Gross revenue",
      value: currency.format(
        performance.grossRevenue.value ?? 0,
      ),
      rawValue: performance.grossRevenue.value,
      trend: performance.grossRevenue.trend,
      icon: CircleDollarSign,
    },
    {
      label: "Occupancy",
      value: `${(performance.occupancyRate.value ?? 0).toFixed(
        1,
      )}%`,
      rawValue: performance.occupancyRate.value,
      trend: performance.occupancyRate.trend,
      icon: Hotel,
    },
    {
      label: "Average daily rate",
      value: currency.format(
        performance.averageDailyRate.value ?? 0,
      ),
      rawValue: performance.averageDailyRate.value,
      trend: performance.averageDailyRate.trend,
      icon: TrendingUp,
    },
    {
      label: "RevPAR",
      value: currency.format(performance.revPar.value ?? 0),
      rawValue: performance.revPar.value,
      trend: performance.revPar.trend,
      icon: TrendingUp,
    },
  ];

  return (
    <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
        Portfolio snapshot
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <div
              key={metric.label}
              className="rounded-2xl bg-stone-50 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <Icon className="h-4 w-4 text-stone-400" />

                <MetricTrend trend={metric.trend} />
              </div>

              <p className="mt-5 text-2xl font-semibold text-stone-950">
                {metric.rawValue === null ? "Unavailable" : metric.value}
              </p>

              <p className="mt-1 text-xs text-stone-500">
                {metric.label}
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-stone-950 px-4 py-4 text-white">
        <div>
          <p className="text-xs text-white/50">
            Total bookings
          </p>

          <p className="mt-1 text-xl font-semibold">
            {performance.totalBookings ?? "Unavailable"}
          </p>
        </div>

        <div className="text-right">
          <p className="flex items-center justify-end gap-2 text-xs text-white/50">
            <CalendarCheck2 className="h-3.5 w-3.5" />
            Upcoming
          </p>

          <p className="mt-1 text-xl font-semibold">
            {performance.upcomingBookings ?? "Unavailable"}
          </p>
        </div>
      </div>
    </section>
  );
}
