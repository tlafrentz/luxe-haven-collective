import { ExecutiveMarketSummary } from "../../domain/entities/executive-market-summary";
import { MarketConfidence } from "../../domain/entities/market-confidence";

export interface ExecutiveIntelligenceSection {
  readonly executiveSummary: string;
  readonly strengths?: readonly string[];
  readonly weaknesses?: readonly string[];
  readonly opportunities?: readonly string[];
  readonly risks?: readonly string[];
  readonly missingInformation?: readonly string[];
  readonly supportingSignals?: readonly string[];
  readonly conflictingSignals?: readonly string[];
}

export interface BuildExecutiveMarketSummaryInput {
  readonly marketName?: string;
  readonly property: ExecutiveIntelligenceSection;
  readonly comparables: ExecutiveIntelligenceSection;
  readonly neighborhood: ExecutiveIntelligenceSection;
  readonly supply: ExecutiveIntelligenceSection;
  readonly demand: ExecutiveIntelligenceSection;
  readonly trends: ExecutiveIntelligenceSection;
  readonly confidence: MarketConfidence;
  readonly headline?: string;
  readonly summary?: string;
  readonly strengths?: readonly string[];
  readonly risks?: readonly string[];
  readonly opportunities?: readonly string[];
  readonly unknowns?: readonly string[];
  readonly recommendedFocus?: readonly string[];
  readonly maximumItemsPerSection?: number;
}

export function buildExecutiveMarketSummary(
  input: BuildExecutiveMarketSummaryInput,
): ExecutiveMarketSummary {
  const maximumItems = Math.max(
    1,
    input.maximumItemsPerSection ?? 5,
  );

  const strengths =
    input.strengths ??
    uniqueLimited(
      [
        ...(input.property.strengths ?? []),
        ...(input.comparables.strengths ?? []),
        ...(input.neighborhood.strengths ?? []),
        ...(input.demand.strengths ?? []),
        ...(input.trends.supportingSignals ?? []),
      ],
      maximumItems,
    );

  const risks =
    input.risks ??
    uniqueLimited(
      [
        ...(input.property.weaknesses ?? []),
        ...(input.property.risks ?? []),
        ...(input.comparables.risks ?? []),
        ...(input.neighborhood.risks ?? []),
        ...(input.supply.risks ?? []),
        ...(input.demand.risks ?? []),
        ...(input.trends.conflictingSignals ?? []),
      ],
      maximumItems,
    );

  const opportunities =
    input.opportunities ??
    uniqueLimited(
      [
        ...(input.property.opportunities ?? []),
        ...(input.comparables.opportunities ?? []),
        ...(input.neighborhood.opportunities ?? []),
        ...(input.supply.opportunities ?? []),
        ...(input.demand.opportunities ?? []),
      ],
      maximumItems,
    );

  const unknowns =
    input.unknowns ??
    uniqueLimited(
      [
        ...(input.property.missingInformation ?? []),
        ...(input.comparables.missingInformation ?? []),
        ...(input.neighborhood.missingInformation ?? []),
        ...(input.supply.missingInformation ?? []),
        ...(input.demand.missingInformation ?? []),
        ...(input.trends.missingInformation ?? []),
        ...input.confidence.missingData,
      ],
      maximumItems,
    );

  const recommendedFocus =
    input.recommendedFocus ??
    deriveRecommendedFocus({
      risks,
      opportunities,
      unknowns,
      confidence: input.confidence,
      maximumItems,
    });

  return ExecutiveMarketSummary.create({
    headline:
      input.headline ??
      buildHeadline({
        marketName: input.marketName,
        confidence: input.confidence,
        risks,
        opportunities,
      }),
    summary:
      input.summary ??
      buildSummary({
        property: input.property,
        comparables: input.comparables,
        neighborhood: input.neighborhood,
        supply: input.supply,
        demand: input.demand,
        trends: input.trends,
        confidence: input.confidence,
      }),
    strengths,
    risks,
    opportunities,
    unknowns,
    recommendedFocus,
  });
}

function buildHeadline(input: {
  readonly marketName?: string;
  readonly confidence: MarketConfidence;
  readonly risks: readonly string[];
  readonly opportunities: readonly string[];
}): string {
  const subject = input.marketName?.trim() || "Market";

  if (
    input.opportunities.length > input.risks.length &&
    input.confidence.overall.value >= 70
  ) {
    return `${subject} presents an attractive, evidence-supported opportunity`;
  }

  if (
    input.risks.length > input.opportunities.length
  ) {
    return `${subject} requires disciplined underwriting before proceeding`;
  }

  return `${subject} presents a balanced market opportunity`;
}

function buildSummary(input: {
  readonly property: ExecutiveIntelligenceSection;
  readonly comparables: ExecutiveIntelligenceSection;
  readonly neighborhood: ExecutiveIntelligenceSection;
  readonly supply: ExecutiveIntelligenceSection;
  readonly demand: ExecutiveIntelligenceSection;
  readonly trends: ExecutiveIntelligenceSection;
  readonly confidence: MarketConfidence;
}): string {
  return [
    input.property.executiveSummary,
    input.comparables.executiveSummary,
    input.neighborhood.executiveSummary,
    input.supply.executiveSummary,
    input.demand.executiveSummary,
    input.trends.executiveSummary,
    input.confidence.executiveSummary,
  ]
    .map((section) => section.trim())
    .filter(Boolean)
    .join(" ");
}

function deriveRecommendedFocus(input: {
  readonly risks: readonly string[];
  readonly opportunities: readonly string[];
  readonly unknowns: readonly string[];
  readonly confidence: MarketConfidence;
  readonly maximumItems: number;
}): readonly string[] {
  const focus: string[] = [];

  if (input.unknowns.length > 0) {
    focus.push(
      `Validate ${input.unknowns[0].toLowerCase()} before final underwriting.`,
    );
  }

  if (input.risks.length > 0) {
    focus.push(
      `Stress-test the investment plan against: ${stripTerminalPunctuation(
        input.risks[0],
      ).toLowerCase()}.`,
    );
  }

  if (input.opportunities.length > 0) {
    focus.push(
      `Test whether the operating strategy can capture: ${stripTerminalPunctuation(
        input.opportunities[0],
      ).toLowerCase()}.`,
    );
  }

  if (input.confidence.weakestDimension.score.value < 70) {
    focus.push(
      `Strengthen ${input.confidence.weakestDimension.name} evidence before relying on the market conclusion.`,
    );
  }

  return uniqueLimited(focus, input.maximumItems);
}

function uniqueLimited(
  values: readonly string[],
  limit: number,
): readonly string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();

    if (!trimmed) {
      continue;
    }

    const normalized = trimmed.toLowerCase();

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    unique.push(trimmed);

    if (unique.length >= limit) {
      break;
    }
  }

  return unique;
}

function stripTerminalPunctuation(value: string): string {
  return value.replace(/[.!?]+$/, "");
}
