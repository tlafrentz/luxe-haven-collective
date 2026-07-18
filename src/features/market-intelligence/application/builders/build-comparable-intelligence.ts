import {
  ComparableIntelligence,
  type ExcludedComparable,
} from "../../domain/entities/comparable-intelligence";
import type { PropertyComparable } from "../../domain/entities/property-comparable";
import { ConfidenceScore } from "../../domain/value-objects/confidence-score";
import { MarketScore } from "../../domain/value-objects/market-score";

export type ComparableMatchQuality =
  | "strong"
  | "moderate"
  | "weak"
  | "excluded";

export interface ComparableIntelligenceObservation {
  readonly comparable: PropertyComparable;
  readonly similarity: number;
  readonly quality: ComparableMatchQuality;
  readonly distanceMiles?: number;
  readonly ageDifferenceYears?: number;
  readonly sizeDifferencePercent?: number;
  readonly estimatedValue?: number;
  readonly exclusionReason?: string;
}

export interface BuildComparableIntelligenceInput {
  readonly observations: readonly ComparableIntelligenceObservation[];
  readonly comparableScore: number;
  readonly confidenceScore: number;
  readonly weightedEstimatedValue?: number;
  readonly currency?: string;
  readonly topComparableLimit?: number;
}

export function buildComparableIntelligence(
  input: BuildComparableIntelligenceInput,
): ComparableIntelligence {
  const topComparableLimit = input.topComparableLimit ?? 3;

  if (!Number.isInteger(topComparableLimit) || topComparableLimit < 0) {
    throw new Error("topComparableLimit must be a non-negative integer.");
  }

  validateObservations(input.observations);

  const included = input.observations.filter(
    (observation) => observation.quality !== "excluded",
  );
  const excluded = input.observations.filter(
    (observation) => observation.quality === "excluded",
  );
  const similarities = included.map(
    (observation) => observation.similarity,
  );
  const comparableValues = included
    .map((observation) => observation.estimatedValue)
    .filter((value): value is number => value !== undefined);

  const topComparables = [...included]
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, topComparableLimit)
    .map((observation) => observation.comparable);

  const excludedComparables: readonly ExcludedComparable[] =
    excluded.map((observation) => ({
      comparableId: observation.comparable.id,
      reason:
        observation.exclusionReason?.trim() ||
        "Excluded from comparable evidence.",
    }));

  const strongMatchCount = countQuality(
    input.observations,
    "strong",
  );

  return ComparableIntelligence.create({
    totalComparableCount: input.observations.length,
    strongMatchCount,
    moderateMatchCount: countQuality(
      input.observations,
      "moderate",
    ),
    weakMatchCount: countQuality(input.observations, "weak"),
    excludedMatchCount: excluded.length,
    averageSimilarity: average(similarities),
    medianSimilarity: median(similarities),
    averageDistanceMiles: averageOptional(
      included.map((observation) => observation.distanceMiles),
    ),
    averageAgeDifferenceYears: averageOptional(
      included.map((observation) => observation.ageDifferenceYears),
    ),
    averageSizeDifferencePercent: averageOptional(
      included.map((observation) => observation.sizeDifferencePercent),
    ),
    weightedEstimatedValue: input.weightedEstimatedValue,
    medianComparableValue:
      comparableValues.length > 0
        ? median(comparableValues)
        : undefined,
    currency:
      input.weightedEstimatedValue !== undefined ||
      comparableValues.length > 0
        ? input.currency ?? "USD"
        : undefined,
    comparableScore: MarketScore.create(input.comparableScore),
    confidence: new ConfidenceScore(input.confidenceScore),
    topComparables,
    excludedComparables,
    executiveSummary: buildExecutiveSummary(
      included.length,
      strongMatchCount,
      excluded.length,
      input.weightedEstimatedValue,
      input.currency ?? "USD",
    ),
  });
}

function validateObservations(
  observations: readonly ComparableIntelligenceObservation[],
): void {
  for (const observation of observations) {
    assertPercentage(observation.similarity, "similarity");
    assertOptionalNonNegative(
      observation.distanceMiles,
      "distanceMiles",
    );
    assertOptionalNonNegative(
      observation.ageDifferenceYears,
      "ageDifferenceYears",
    );
    assertOptionalNonNegative(
      observation.sizeDifferencePercent,
      "sizeDifferencePercent",
    );
    assertOptionalNonNegative(
      observation.estimatedValue,
      "estimatedValue",
    );
  }
}

function buildExecutiveSummary(
  includedCount: number,
  strongCount: number,
  excludedCount: number,
  weightedEstimatedValue: number | undefined,
  currency: string,
): string {
  const evidenceStatement =
    includedCount >= 3
      ? `Comparable evidence is sufficient with ${includedCount} included properties`
      : `Comparable evidence is limited to ${includedCount} included ${
          includedCount === 1 ? "property" : "properties"
        }`;

  const matchStatement =
    strongCount > 0
      ? `, including ${strongCount} strong ${
          strongCount === 1 ? "match" : "matches"
        }`
      : "";

  const exclusionStatement =
    excludedCount > 0
      ? `. ${excludedCount} ${
          excludedCount === 1 ? "property was" : "properties were"
        } excluded`
      : "";

  const valuationStatement =
    weightedEstimatedValue === undefined
      ? ". No weighted valuation conclusion is available."
      : `. The weighted estimated value is ${formatCurrency(
          weightedEstimatedValue,
          currency,
        )}.`;

  return `${evidenceStatement}${matchStatement}${exclusionStatement}${valuationStatement}`;
}

function countQuality(
  observations: readonly ComparableIntelligenceObservation[],
  quality: ComparableMatchQuality,
): number {
  return observations.filter(
    (observation) => observation.quality === quality,
  ).length;
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
    2,
  );
}

function averageOptional(
  values: readonly (number | undefined)[],
): number | undefined {
  const definedValues = values.filter(
    (value): value is number => value !== undefined,
  );

  return definedValues.length === 0
    ? undefined
    : average(definedValues);
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1
    ? round(sorted[midpoint], 2)
    : round((sorted[midpoint - 1] + sorted[midpoint]) / 2, 2);
}

function assertPercentage(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`${field} must be between 0 and 100.`);
  }
}

function assertOptionalNonNegative(
  value: number | undefined,
  field: string,
): void {
  if (
    value !== undefined &&
    (!Number.isFinite(value) || value < 0)
  ) {
    throw new Error(`${field} must be a finite, non-negative number.`);
  }
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
