import type {
  ComparableAnalysis,
} from "../domain/entities/comparable-analysis";

import type {
  MarketValuation,
} from "../domain/entities/market-valuation";

import {
  MarketAnalysisFinding,
} from "../domain/value-objects/market-analysis-finding";

export interface BuildMarketAnalysisFindingsInput {
  readonly analysis:
    ComparableAnalysis;
  readonly valuation:
    MarketValuation;
}

export function buildMarketAnalysisFindings(
  input:
    BuildMarketAnalysisFindingsInput,
): readonly MarketAnalysisFinding[] {
  const findings:
    MarketAnalysisFinding[] = [];

  const confidence =
    input.valuation
      .confidence;

  if (
    confidence.level ===
      "high"
  ) {
    findings.push(
      new MarketAnalysisFinding({
        type: "strength",
        title:
          "Strong valuation support",
        description:
          `The valuation is supported by ${confidence.comparableCount} comparables with an average similarity of ${formatNumber(confidence.averageSimilarity)}.`,
        severity: "low",
      }),
    );
  }

  if (
    confidence.comparableCount <
      3
  ) {
    findings.push(
      new MarketAnalysisFinding({
        type: "data-gap",
        title:
          "Limited comparable set",
        description:
          "Fewer than three usable comparables were available, which reduces valuation reliability.",
        severity: "high",
      }),
    );
  }

  if (
    confidence.averageSimilarity <
      70
  ) {
    findings.push(
      new MarketAnalysisFinding({
        type: "risk",
        title:
          "Weak comparable similarity",
        description:
          `Average comparable similarity is ${formatNumber(confidence.averageSimilarity)}, below the preferred threshold of 70.`,
        severity:
          confidence.averageSimilarity <
            50
            ? "high"
            : "moderate",
      }),
    );
  }

  if (
    confidence.dispersionRatio >
      0.2
  ) {
    findings.push(
      new MarketAnalysisFinding({
        type: "risk",
        title:
          "Wide value dispersion",
        description:
          `Comparable values have a dispersion ratio of ${formatPercent(confidence.dispersionRatio)}, indicating meaningful disagreement in the market evidence.`,
        severity:
          confidence.dispersionRatio >
            0.35
            ? "high"
            : "moderate",
      }),
    );
  }

  if (
    input.valuation
      .excludedComparableIds
      .length > 0
  ) {
    findings.push(
      new MarketAnalysisFinding({
        type:
          "observation",
        title:
          "Outliers excluded",
        description:
          `${input.valuation.excludedComparableIds.length} comparable ${input.valuation.excludedComparableIds.length === 1 ? "was" : "were"} excluded from the valuation as a material outlier.`,
        severity: "low",
      }),
    );
  }

  if (
    input.analysis
      .subject
      .squareFeet ===
      undefined
  ) {
    findings.push(
      new MarketAnalysisFinding({
        type:
          "data-gap",
        title:
          "Subject square footage missing",
        description:
          "Weighted price-per-square-foot analysis could not be fully evaluated because subject square footage is unavailable.",
        severity:
          "moderate",
      }),
    );
  }

  if (
    findings.length === 0
  ) {
    findings.push(
      new MarketAnalysisFinding({
        type:
          "observation",
        title:
          "Valuation completed",
        description:
          "The available comparable evidence produced a usable market valuation without material exceptions.",
        severity: "low",
      }),
    );
  }

  return findings;
}

function formatNumber(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      maximumFractionDigits: 1,
    },
  ).format(value);
}

function formatPercent(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "percent",
      maximumFractionDigits: 1,
    },
  ).format(value);
}
