export interface ConfidenceDimension {
  readonly name: string;
  readonly score: number;
  readonly weight: number;
}

export interface CalculateOverallConfidenceInput {
  readonly dimensions: readonly ConfidenceDimension[];
  readonly providerCoveragePercent?: number;
  readonly missingDataCount?: number;
  readonly conflictingSignalCount?: number;
}

export function calculateOverallConfidence(
  input: CalculateOverallConfidenceInput,
): number {
  const weightedBase = weightedConfidenceAverage(input.dimensions);

  const coveragePenalty =
    input.providerCoveragePercent === undefined
      ? 0
      : calculateCoveragePenalty(input.providerCoveragePercent);

  const missingDataPenalty = Math.min(
    12,
    Math.max(0, input.missingDataCount ?? 0) * 2,
  );

  const conflictPenalty = Math.min(
    10,
    Math.max(0, input.conflictingSignalCount ?? 0) * 2.5,
  );

  return clampConfidence(
    weightedBase -
      coveragePenalty -
      missingDataPenalty -
      conflictPenalty,
  );
}

export function weightedConfidenceAverage(
  dimensions: readonly ConfidenceDimension[],
): number {
  const usableDimensions = dimensions.filter(
    (dimension) =>
      Number.isFinite(dimension.score) &&
      Number.isFinite(dimension.weight) &&
      dimension.weight > 0,
  );

  if (usableDimensions.length === 0) {
    return 0;
  }

  const totalWeight = usableDimensions.reduce(
    (sum, dimension) => sum + dimension.weight,
    0,
  );

  return round(
    usableDimensions.reduce(
      (sum, dimension) =>
        sum + clampConfidence(dimension.score) * dimension.weight,
      0,
    ) / totalWeight,
  );
}

export function calculateProviderCoveragePercent(
  availableProviderCount: number,
  expectedProviderCount: number,
): number | undefined {
  if (
    !Number.isFinite(availableProviderCount) ||
    !Number.isFinite(expectedProviderCount) ||
    expectedProviderCount <= 0
  ) {
    return undefined;
  }

  return clampConfidence(
    (Math.max(0, availableProviderCount) /
      expectedProviderCount) *
      100,
  );
}

export function deriveConfidenceExplanations(input: {
  readonly dimensions: readonly ConfidenceDimension[];
  readonly providerCoveragePercent?: number;
  readonly missingData?: readonly string[];
  readonly conflictingSignalCount?: number;
}): readonly string[] {
  const explanations: string[] = [];

  const strongest = findStrongestDimension(input.dimensions);
  const weakest = findWeakestDimension(input.dimensions);

  if (strongest) {
    explanations.push(
      `${titleCase(strongest.name)} evidence is the strongest confidence dimension at ${clampConfidence(
        strongest.score,
      )}.`,
    );
  }

  if (weakest) {
    explanations.push(
      `${titleCase(weakest.name)} evidence is the weakest confidence dimension at ${clampConfidence(
        weakest.score,
      )}.`,
    );
  }

  if (input.providerCoveragePercent !== undefined) {
    explanations.push(
      `Provider coverage is ${clampConfidence(
        input.providerCoveragePercent,
      )}%.`,
    );
  }

  const missingCount = input.missingData?.length ?? 0;
  if (missingCount > 0) {
    explanations.push(
      `${missingCount} material ${
        missingCount === 1 ? "data gap reduces" : "data gaps reduce"
      } confidence.`,
    );
  }

  const conflictingSignalCount =
    input.conflictingSignalCount ?? 0;
  if (conflictingSignalCount > 0) {
    explanations.push(
      `${conflictingSignalCount} ${
        conflictingSignalCount === 1
          ? "conflicting signal requires"
          : "conflicting signals require"
      } additional validation.`,
    );
  }

  return explanations;
}

export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(100, Math.max(0, round(value)));
}

function calculateCoveragePenalty(
  providerCoveragePercent: number,
): number {
  const coverage = clampConfidence(providerCoveragePercent);

  if (coverage >= 80) {
    return 0;
  }

  return round(((80 - coverage) / 80) * 15);
}

function findStrongestDimension(
  dimensions: readonly ConfidenceDimension[],
): ConfidenceDimension | undefined {
  return dimensions.reduce<ConfidenceDimension | undefined>(
    (strongest, dimension) =>
      strongest === undefined ||
      dimension.score > strongest.score
        ? dimension
        : strongest,
    undefined,
  );
}

function findWeakestDimension(
  dimensions: readonly ConfidenceDimension[],
): ConfidenceDimension | undefined {
  return dimensions.reduce<ConfidenceDimension | undefined>(
    (weakest, dimension) =>
      weakest === undefined ||
      dimension.score < weakest.score
        ? dimension
        : weakest,
    undefined,
  );
}

function titleCase(value: string): string {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function round(value: number, precision = 2): number {
  const multiplier = 10 ** precision;
  return Math.round(value * multiplier) / multiplier;
}
