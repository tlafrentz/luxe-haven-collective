import { TrendDirection } from "../../../domain/enums/trend-direction";

const TREND_WEIGHTS: Readonly<Record<string, number>> = Object.freeze({
  "strongly-negative": -2,
  strongly_negative: -2,
  stronglynegative: -2,
  declining: -1,
  negative: -1,
  down: -1,
  stable: 0,
  neutral: 0,
  flat: 0,
  mixed: 0,
  positive: 1,
  growing: 1,
  up: 1,
  "strongly-positive": 2,
  strongly_positive: 2,
  stronglypositive: 2,
});

export interface WeightedTrend {
  readonly direction: TrendDirection;
  readonly weight: number;
}

export function scoreTrendDirection(
  direction: TrendDirection,
): number {
  const normalized = normalizeTrendValue(direction);

  return TREND_WEIGHTS[normalized] ?? 0;
}

export function deriveOverallTrend(
  trends: readonly WeightedTrend[],
): TrendDirection {
  if (trends.length === 0) {
    throw new Error(
      "deriveOverallTrend requires at least one trend signal.",
    );
  }

  const usableTrends = trends.filter(
    (trend) => Number.isFinite(trend.weight) && trend.weight > 0,
  );

  if (usableTrends.length === 0) {
    return trends[0].direction;
  }

  const weightedScore =
    usableTrends.reduce(
      (sum, trend) =>
        sum + scoreTrendDirection(trend.direction) * trend.weight,
      0,
    ) /
    usableTrends.reduce((sum, trend) => sum + trend.weight, 0);

  return findClosestSuppliedDirection(
    usableTrends.map((trend) => trend.direction),
    weightedScore,
  );
}

export function calculateMomentumScore(
  trends: readonly WeightedTrend[],
): number {
  if (trends.length === 0) {
    return 50;
  }

  const usableTrends = trends.filter(
    (trend) => Number.isFinite(trend.weight) && trend.weight > 0,
  );

  if (usableTrends.length === 0) {
    return 50;
  }

  const weightedTrend =
    usableTrends.reduce(
      (sum, trend) =>
        sum + scoreTrendDirection(trend.direction) * trend.weight,
      0,
    ) /
    usableTrends.reduce((sum, trend) => sum + trend.weight, 0);

  return Math.min(
    100,
    Math.max(0, Math.round((50 + weightedTrend * 25) * 100) / 100),
  );
}

export function isPositiveTrend(
  direction: TrendDirection,
): boolean {
  return scoreTrendDirection(direction) > 0;
}

export function isNegativeTrend(
  direction: TrendDirection,
): boolean {
  return scoreTrendDirection(direction) < 0;
}

export function describeTrend(
  direction: TrendDirection,
): string {
  return String(direction)
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

function findClosestSuppliedDirection(
  directions: readonly TrendDirection[],
  targetScore: number,
): TrendDirection {
  return directions.reduce((closest, direction) => {
    const closestDistance = Math.abs(
      scoreTrendDirection(closest) - targetScore,
    );
    const currentDistance = Math.abs(
      scoreTrendDirection(direction) - targetScore,
    );

    return currentDistance < closestDistance ? direction : closest;
  });
}

function normalizeTrendValue(direction: TrendDirection): string {
  return String(direction)
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
}
