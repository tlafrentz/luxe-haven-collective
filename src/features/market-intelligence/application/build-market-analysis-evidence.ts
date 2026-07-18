import type {
  ComparableAnalysis,
} from "../domain/entities/comparable-analysis";

import type {
  MarketValuation,
} from "../domain/entities/market-valuation";

import {
  MarketAnalysisEvidence,
} from "../domain/value-objects/market-analysis-evidence";

export interface BuildMarketAnalysisEvidenceInput {
  readonly analysis:
    ComparableAnalysis;
  readonly valuation:
    MarketValuation;
}

export function buildMarketAnalysisEvidence(
  input:
    BuildMarketAnalysisEvidenceInput,
): readonly MarketAnalysisEvidence[] {
  const evidence:
    MarketAnalysisEvidence[] = [
      new MarketAnalysisEvidence({
        type:
          "subject-property",
        label:
          "Subject property",
        value:
          input.analysis
            .subject
            .address,
      }),

      new MarketAnalysisEvidence({
        type:
          "valuation",
        label:
          "Estimated market value",
        value:
          formatCurrency(
            input.valuation
              .valueRange
              .estimated,
          ),
      }),

      new MarketAnalysisEvidence({
        type:
          "valuation",
        label:
          "Valuation range",
        value:
          `${formatCurrency(input.valuation.valueRange.low)}–${formatCurrency(input.valuation.valueRange.high)}`,
      }),

      new MarketAnalysisEvidence({
        type:
          "calculation",
        label:
          "Confidence",
        value:
          `${formatNumber(input.valuation.confidence.score)} / 100 (${input.valuation.confidence.level})`,
      }),

      new MarketAnalysisEvidence({
        type:
          "calculation",
        label:
          "Supporting comparables",
        value:
          String(
            input.valuation
              .supportingComparables
              .length,
          ),
      }),

      new MarketAnalysisEvidence({
        type:
          "calculation",
        label:
          "Average similarity",
        value:
          `${formatNumber(input.valuation.confidence.averageSimilarity)} / 100`,
      }),
    ];

  if (
    input.valuation
      .weightedPricePerSquareFoot !==
      undefined
  ) {
    evidence.push(
      new MarketAnalysisEvidence({
        type:
          "valuation",
        label:
          "Weighted price per square foot",
        value:
          formatCurrency(
            input.valuation
              .weightedPricePerSquareFoot,
          ),
      }),
    );
  }

  if (
    input.valuation
      .medianPricePerSquareFoot !==
      undefined
  ) {
    evidence.push(
      new MarketAnalysisEvidence({
        type:
          "valuation",
        label:
          "Median comparable price per square foot",
        value:
          formatCurrency(
            input.valuation
              .medianPricePerSquareFoot,
          ),
      }),
    );
  }

  for (
    const comparable of
    input.valuation
      .supportingComparables
  ) {
    const id =
      comparable
        .comparable
        .id;

    evidence.push(
      new MarketAnalysisEvidence({
        type:
          "comparable-property",
        label:
          `Comparable ${id}`,
        value:
          buildComparableValue(
            comparable,
          ),
      }),
    );
  }

  return evidence;
}

function buildComparableValue(
  comparable:
    import(
      "../domain/entities/weighted-comparable"
    ).WeightedComparable,
): string {
  const parts = [
    comparable.adjustedValue !==
      undefined
      ? formatCurrency(
          comparable.adjustedValue,
        )
      : "Value unavailable",
    `${formatNumber(comparable.similarityScore.value)} similarity`,
    `${formatPercent(comparable.weight.value)} weight`,
  ];

  return parts.join(" · ");
}

function formatCurrency(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    },
  ).format(value);
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
