import type {
  AnalyticsDateRange,
  MetricTrend,
} from "../types";

import { addDays } from "./date-range";
import { canonicalComparison } from "@/platform/calculations";

const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

export function getPreviousDateRange(
  current: AnalyticsDateRange,
): AnalyticsDateRange {
  const start = new Date(
    `${current.startDate}T00:00:00.000Z`,
  );

  const end = new Date(
    `${current.endDate}T00:00:00.000Z`,
  );

  const durationDays = Math.max(
    1,
    Math.round(
      (end.getTime() - start.getTime()) /
        MILLISECONDS_PER_DAY,
    ),
  );

  return {
    startDate: addDays(
      current.startDate,
      -durationDays,
    ),
    endDate: current.startDate,
  };
}

export function calculateTrend(
  current: number,
  previous: number,
): MetricTrend {
  const comparison = canonicalComparison(current, previous);
  return {
    difference: roundMetric(comparison.absolute),
    percentChange: comparison.percentage === null ? 0 : roundMetric(comparison.percentage),
    direction: comparison.direction,
    status: comparison.status,
    ...(comparison.status === "unavailable" ? { reason: comparison.reason } : {}),
  };
}

function roundMetric(value: number): number {
  return Math.round(
    (value + Number.EPSILON) * 10,
  ) / 10;
}
