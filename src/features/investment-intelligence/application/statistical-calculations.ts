export function calculateMedian(
  values: readonly number[],
  fieldName: string,
): number {
  if (values.length === 0) {
    throw new Error(
      `${fieldName} requires at least one value.`,
    );
  }

  for (const value of values) {
    if (
      !Number.isFinite(value) ||
      value < 0
    ) {
      throw new Error(
        `${fieldName} values must be finite, non-negative numbers.`,
      );
    }
  }

  const sortedValues = [
    ...values,
  ].sort((left, right) => left - right);

  const middleIndex =
    Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 0) {
    return (
      sortedValues[middleIndex - 1] +
      sortedValues[middleIndex]
    ) / 2;
  }

  return sortedValues[middleIndex];
}
