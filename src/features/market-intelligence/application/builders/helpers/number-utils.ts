export function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, round(value)));
}

export function averageDefined(
  values: readonly (number | undefined)[],
): number | undefined {
  const definedValues = values.filter(
    (value): value is number => value !== undefined,
  );

  if (definedValues.length === 0) {
    return undefined;
  }

  return round(
    definedValues.reduce((sum, value) => sum + value, 0) /
      definedValues.length,
  );
}

export function weightedAverage(
  values: readonly {
    readonly value: number | undefined;
    readonly weight: number;
  }[],
): number | undefined {
  const usableValues = values.filter(
    (
      item,
    ): item is {
      readonly value: number;
      readonly weight: number;
    } =>
      item.value !== undefined &&
      Number.isFinite(item.value) &&
      Number.isFinite(item.weight) &&
      item.weight > 0,
  );

  const totalWeight = usableValues.reduce(
    (sum, item) => sum + item.weight,
    0,
  );

  if (totalWeight === 0) {
    return undefined;
  }

  return round(
    usableValues.reduce(
      (sum, item) => sum + item.value * item.weight,
      0,
    ) / totalWeight,
  );
}

export function round(value: number, precision = 2): number {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}
