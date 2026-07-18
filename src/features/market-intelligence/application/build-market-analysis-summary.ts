import type {
  ComparableAnalysis,
} from "../domain/entities/comparable-analysis";

import type {
  MarketValuation,
} from "../domain/entities/market-valuation";

export interface BuildMarketAnalysisSummaryInput {
  readonly analysis:
    ComparableAnalysis;
  readonly valuation:
    MarketValuation;
}

export function buildMarketAnalysisSummary(
  input:
    BuildMarketAnalysisSummaryInput,
): string {
  const range =
    input.valuation
      .valueRange;

  const confidence =
    input.valuation
      .confidence;

  const comparableCount =
    input.valuation
      .supportingComparables
      .length;

  const outlierStatement =
    input.valuation
      .excludedComparableIds
      .length > 0
      ? ` ${input.valuation.excludedComparableIds.length} outlier ${input.valuation.excludedComparableIds.length === 1 ? "was" : "were"} excluded.`
      : "";

  return [
    `${input.analysis.subject.address} has an estimated market value of ${formatCurrency(range.estimated)},`,
    `with a supported range of ${formatCurrency(range.low)} to ${formatCurrency(range.high)}.`,
    `The estimate is based on ${comparableCount} comparable ${comparableCount === 1 ? "property" : "properties"}`,
    `and carries ${confidence.level} confidence (${formatNumber(confidence.score)} / 100).`,
    outlierStatement,
  ]
    .join(" ")
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
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
