import type {
  AnalyticsDateRange,
  MetricTrend,
} from "../types";

import { addDays } from "./date-range";

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
  const difference = current - previous;

  if (previous === 0) {
    return {
      difference,
      percentChange: current === 0 ? 0 : 100,
      direction:
        current > 0
          ? "up"
          : current < 0
            ? "down"
            : "neutral",
    };
  }

  const percentChange =
    (difference / Math.abs(previous)) * 100;

  return {
    difference: roundMetric(difference),
    percentChange: roundMetric(percentChange),
    direction:
      difference > 0
        ? "up"
        : difference < 0
          ? "down"
          : "neutral",
  };
}

function roundMetric(value: number): number {
  return Math.round(
    (value + Number.EPSILON) * 10,
  ) / 10;
}
