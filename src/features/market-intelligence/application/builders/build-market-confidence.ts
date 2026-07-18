import { MarketConfidence } from "../../domain/entities/market-confidence";
import { ConfidenceScore } from "../../domain/value-objects/confidence-score";
import {
  calculateOverallConfidence,
  deriveConfidenceExplanations,
  type ConfidenceDimension,
} from "./helpers/confidence-utils";

export interface BuildMarketConfidenceInput {
  readonly propertyScore: number;
  readonly comparablesScore: number;
  readonly neighborhoodScore: number;
  readonly supplyScore: number;
  readonly demandScore: number;
  readonly trendsScore: number;
  readonly providerCoveragePercent?: number;
  readonly missingData?: readonly string[];
  readonly conflictingSignalCount?: number;
  readonly explanations?: readonly string[];
  readonly overallScore?: number;
}

export function buildMarketConfidence(
  input: BuildMarketConfidenceInput,
): MarketConfidence {
  const dimensions = buildDimensions(input);
  const missingData = input.missingData ?? [];

  const overallScore =
    input.overallScore ??
    calculateOverallConfidence({
      dimensions,
      providerCoveragePercent:
        input.providerCoveragePercent,
      missingDataCount: missingData.length,
      conflictingSignalCount:
        input.conflictingSignalCount,
    });

  const explanations =
    input.explanations ??
    deriveConfidenceExplanations({
      dimensions,
      providerCoveragePercent:
        input.providerCoveragePercent,
      missingData,
      conflictingSignalCount:
        input.conflictingSignalCount,
    });

  const overall = new ConfidenceScore(overallScore);
  const property = new ConfidenceScore(input.propertyScore);
  const comparables = new ConfidenceScore(
    input.comparablesScore,
  );
  const neighborhood = new ConfidenceScore(
    input.neighborhoodScore,
  );
  const supply = new ConfidenceScore(input.supplyScore);
  const demand = new ConfidenceScore(input.demandScore);
  const trends = new ConfidenceScore(input.trendsScore);

  return MarketConfidence.create({
    overall,
    property,
    comparables,
    neighborhood,
    supply,
    demand,
    trends,
    providerCoveragePercent:
      input.providerCoveragePercent,
    missingData,
    explanations,
    executiveSummary: buildExecutiveSummary({
      overallScore: overall.value,
      weakestDimension: findWeakestDimension(dimensions),
      providerCoveragePercent:
        input.providerCoveragePercent,
      missingDataCount: missingData.length,
      conflictingSignalCount:
        input.conflictingSignalCount ?? 0,
    }),
  });
}

function buildDimensions(
  input: BuildMarketConfidenceInput,
): readonly ConfidenceDimension[] {
  return [
    {
      name: "property",
      score: input.propertyScore,
      weight: 0.15,
    },
    {
      name: "comparables",
      score: input.comparablesScore,
      weight: 0.25,
    },
    {
      name: "neighborhood",
      score: input.neighborhoodScore,
      weight: 0.1,
    },
    {
      name: "supply",
      score: input.supplyScore,
      weight: 0.15,
    },
    {
      name: "demand",
      score: input.demandScore,
      weight: 0.2,
    },
    {
      name: "trends",
      score: input.trendsScore,
      weight: 0.15,
    },
  ];
}

function findWeakestDimension(
  dimensions: readonly ConfidenceDimension[],
): ConfidenceDimension {
  return dimensions.reduce((weakest, dimension) =>
    dimension.score < weakest.score
      ? dimension
      : weakest,
  );
}

function buildExecutiveSummary(input: {
  readonly overallScore: number;
  readonly weakestDimension: ConfidenceDimension;
  readonly providerCoveragePercent?: number;
  readonly missingDataCount: number;
  readonly conflictingSignalCount: number;
}): string {
  const coverageStatement =
    input.providerCoveragePercent === undefined
      ? "Provider coverage has not been quantified."
      : `Provider coverage is ${input.providerCoveragePercent}%.`;

  return `Overall market confidence scores ${input.overallScore}. ${coverageStatement} The weakest evidence dimension is ${input.weakestDimension.name} at ${input.weakestDimension.score}. ${input.missingDataCount} ${
    input.missingDataCount === 1 ? "material data gap remains" : "material data gaps remain"
  }, and ${input.conflictingSignalCount} ${
    input.conflictingSignalCount === 1
      ? "conflicting signal requires"
      : "conflicting signals require"
  } validation.`;
}
