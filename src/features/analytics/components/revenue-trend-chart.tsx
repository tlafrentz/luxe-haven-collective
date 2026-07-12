"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { RevenueDataPoint } from "../types";

type RevenueTrendChartProps = {
  data: RevenueDataPoint[];
};

type RevenueTooltipProps = {
  active?: boolean;
  payload?: Array<{
    value?: number;
  }>;
  label?: string;
};

function formatAxisDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatTooltipDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function RevenueTooltip({
  active,
  payload,
  label,
}: RevenueTooltipProps) {
  if (
    !active ||
    !payload?.length ||
    !label
  ) {
    return null;
  }

  const revenue = payload[0]?.value ?? 0;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-xs font-medium text-neutral-500">
        {formatTooltipDate(label)}
      </p>

      <p className="mt-1 text-sm font-semibold text-neutral-950">
        {formatCurrency(revenue)}
      </p>

      <p className="mt-0.5 text-xs text-neutral-500">
        Room revenue
      </p>
    </div>
  );
}

export function RevenueTrendChart({
  data,
}: RevenueTrendChartProps) {
  const hasRevenue = data.some(
    (point) => point.revenue > 0,
  );

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            Revenue performance
          </p>

          <h2 className="mt-1 text-xl font-semibold text-neutral-950">
            Daily revenue trend
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            Nightly room revenue across the selected reporting
            period.
          </p>
        </div>

        <div className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
          Room revenue
        </div>
      </div>

      {!hasRevenue ? (
        <div className="flex h-80 items-center justify-center rounded-xl bg-neutral-50">
          <div className="max-w-sm px-6 text-center">
            <h3 className="text-sm font-semibold text-neutral-950">
              No revenue in this period
            </h3>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Select a reporting range containing confirmed or
              completed bookings to view the revenue trend.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-6 h-80 w-full">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <AreaChart
              data={data}
              margin={{
                top: 10,
                right: 10,
                left: 0,
                bottom: 0,
              }}
            >
              <defs>
                <linearGradient
                  id="revenueGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="currentColor"
                    stopOpacity={0.18}
                  />

                  <stop
                    offset="95%"
                    stopColor="currentColor"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e5e5"
              />

              <XAxis
                dataKey="date"
                tickFormatter={formatAxisDate}
                axisLine={false}
                tickLine={false}
                minTickGap={28}
                tick={{
                  fill: "#737373",
                  fontSize: 12,
                }}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                width={58}
                tickFormatter={(value: number) =>
                  formatCurrency(value)
                }
                tick={{
                  fill: "#737373",
                  fontSize: 12,
                }}
              />

              <Tooltip
                content={<RevenueTooltip />}
                cursor={{
                  stroke: "#a3a3a3",
                  strokeDasharray: "4 4",
                }}
              />

              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#059669"
                strokeWidth={2.5}
                fill="url(#revenueGradient)"
                activeDot={{
                  r: 5,
                  fill: "#059669",
                  stroke: "#ffffff",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
