/** @deprecated Compatibility vocabulary mapped to Platform Intelligence Trend direction. */
export enum TrendDirection {
  StronglyPositive = "strongly-positive",
  Positive = "positive",
  Stable = "stable",
  Negative = "negative",
  StronglyNegative = "strongly-negative",
  Unknown = "unknown",
}

export function isTrendDirection(
  value: unknown,
): value is TrendDirection {
  return Object.values(TrendDirection).includes(value as TrendDirection);
}
