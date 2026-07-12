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

import type { OccupancyDataPoint } from "../types";

type OccupancyTrendChartProps = {
  data: OccupancyDataPoint[];
};

type OccupancyTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload?: OccupancyDataPoint;
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

function OccupancyTooltip({
  active,
  payload,
  label,
}: OccupancyTooltipProps) {
  if (
    !active ||
    !payload?.length ||
    !label
  ) {
    return null;
  }

  const point = payload[0]?.payload;

  if (!point) {
    return null;
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-xs font-medium text-neutral-500">
        {formatTooltipDate(label)}
      </p>

      <p className="mt-1 text-sm font-semibold text-neutral-950">
        {point.occupancyRate.toFixed(1)}% occupancy
      </p>

      <p className="mt-0.5 text-xs text-neutral-500">
        {point.occupiedNights} of{" "}
        {point.availableNights} available{" "}
        {point.availableNights === 1
          ? "night"
          : "nights"}
      </p>
    </div>
  );
}

export function OccupancyTrendChart({
  data,
}: OccupancyTrendChartProps) {
  const hasOccupancy = data.some(
    (point) => point.occupiedNights > 0,
  );

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            Occupancy performance
          </p>

          <h2 className="mt-1 text-xl font-semibold text-neutral-950">
            Daily occupancy trend
          </h2>

          <p className="mt-1 text-sm text-neutral-500">
            Daily occupied inventory across the selected
            reporting period.
          </p>
        </div>

        <div className="w-fit rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
          Occupancy rate
        </div>
      </div>

      {!hasOccupancy ? (
        <div className="mt-6 flex h-80 items-center justify-center rounded-xl bg-neutral-50">
          <div className="max-w-sm px-6 text-center">
            <h3 className="text-sm font-semibold text-neutral-950">
              No occupied nights in this period
            </h3>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Select a reporting range containing confirmed or
              completed bookings to view occupancy trends.
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
                  id="occupancyGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="#2563eb"
                    stopOpacity={0.18}
                  />

                  <stop
                    offset="95%"
                    stopColor="#2563eb"
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
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(value: number) =>
                  `${value}%`
                }
                tick={{
                  fill: "#737373",
                  fontSize: 12,
                }}
              />

              <Tooltip
                content={<OccupancyTooltip />}
                cursor={{
                  stroke: "#a3a3a3",
                  strokeDasharray: "4 4",
                }}
              />

              <Area
                type="stepAfter"
                dataKey="occupancyRate"
                stroke="#2563eb"
                strokeWidth={2.5}
                fill="url(#occupancyGradient)"
                activeDot={{
                  r: 5,
                  fill: "#2563eb",
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
