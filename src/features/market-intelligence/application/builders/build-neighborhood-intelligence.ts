import {
  NeighborhoodIntelligence,
  type NeighborhoodDimension,
} from "../../domain/entities/neighborhood-intelligence";
import { ConfidenceScore } from "../../domain/value-objects/confidence-score";
import { MarketScore } from "../../domain/value-objects/market-score";

export interface NeighborhoodDimensionInput {
  readonly score: number;
  readonly explanation?: string;
}

export interface BuildNeighborhoodIntelligenceInput {
  readonly neighborhoodName: string;
  readonly walkability: NeighborhoodDimensionInput;
  readonly dining: NeighborhoodDimensionInput;
  readonly entertainment: NeighborhoodDimensionInput;
  readonly businessTravel: NeighborhoodDimensionInput;
  readonly airportAccess: NeighborhoodDimensionInput;
  readonly medicalAccess: NeighborhoodDimensionInput;
  readonly universityAccess: NeighborhoodDimensionInput;
  readonly conventionDemand: NeighborhoodDimensionInput;
  readonly hospitalitySuitability: NeighborhoodDimensionInput;
  readonly confidenceScore: number;
  readonly strengths?: readonly string[];
  readonly risks?: readonly string[];
  readonly missingInformation?: readonly string[];
}

export function buildNeighborhoodIntelligence(
  input: BuildNeighborhoodIntelligenceInput,
): NeighborhoodIntelligence {
  const dimensions = {
    walkability: buildDimension(input.walkability),
    dining: buildDimension(input.dining),
    entertainment: buildDimension(input.entertainment),
    businessTravel: buildDimension(input.businessTravel),
    airportAccess: buildDimension(input.airportAccess),
    medicalAccess: buildDimension(input.medicalAccess),
    universityAccess: buildDimension(input.universityAccess),
    conventionDemand: buildDimension(input.conventionDemand),
    hospitalitySuitability: buildDimension(
      input.hospitalitySuitability,
    ),
  };

  const neighborhoodScore = MarketScore.create(
    average(
      Object.values(dimensions).map(
        (dimension) => dimension.score.value,
      ),
    ),
  );

  const strengths = input.strengths ?? deriveStrengths(dimensions);
  const risks = input.risks ?? deriveRisks(dimensions);
  const missingInformation = input.missingInformation ?? [];

  return NeighborhoodIntelligence.create({
    neighborhoodName: input.neighborhoodName,
    ...dimensions,
    neighborhoodScore,
    confidence: new ConfidenceScore(input.confidenceScore),
    strengths,
    risks,
    missingInformation,
    executiveSummary: buildExecutiveSummary(
      input.neighborhoodName,
      neighborhoodScore,
      strengths,
      risks,
      missingInformation,
    ),
  });
}

function buildDimension(
  input: NeighborhoodDimensionInput,
): NeighborhoodDimension {
  const score = MarketScore.create(input.score);

  return {
    score,
    rating: score.rating,
    explanation: input.explanation?.trim(),
  };
}

function deriveStrengths(
  dimensions: Readonly<Record<string, NeighborhoodDimension>>,
): readonly string[] {
  return Object.entries(dimensions)
    .filter(([, dimension]) => dimension.score.value >= 70)
    .map(([name]) => `${formatDimensionName(name)} is a market strength.`);
}

function deriveRisks(
  dimensions: Readonly<Record<string, NeighborhoodDimension>>,
): readonly string[] {
  return Object.entries(dimensions)
    .filter(([, dimension]) => dimension.score.value < 40)
    .map(([name]) => `${formatDimensionName(name)} may limit demand.`);
}

function buildExecutiveSummary(
  neighborhoodName: string,
  neighborhoodScore: MarketScore,
  strengths: readonly string[],
  risks: readonly string[],
  missingInformation: readonly string[],
): string {
  const riskStatement =
    risks.length === 0
      ? "No major neighborhood demand risks were identified."
      : `${risks.length} material neighborhood ${
          risks.length === 1 ? "risk was" : "risks were"
        } identified.`;

  const gapStatement =
    missingInformation.length === 0
      ? "The neighborhood profile contains no declared data gaps."
      : `${missingInformation.length} neighborhood data ${
          missingInformation.length === 1 ? "gap remains" : "gaps remain"
        }.`;

  return `${neighborhoodName} has an overall neighborhood score of ${neighborhoodScore.value}, with ${strengths.length} identified ${
    strengths.length === 1 ? "strength" : "strengths"
  }. ${riskStatement} ${gapStatement}`;
}

function average(values: readonly number[]): number {
  const result =
    values.reduce((sum, value) => sum + value, 0) / values.length;

  return Math.round(result * 100) / 100;
}

function formatDimensionName(value: string): string {
  return value
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase());
}
