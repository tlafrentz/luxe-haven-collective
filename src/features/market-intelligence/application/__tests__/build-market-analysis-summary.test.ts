import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ComparableAnalysis,
} from "../../domain/entities/comparable-analysis";

import type {
  MarketValuation,
} from "../../domain/entities/market-valuation";

import {
  buildMarketAnalysisSummary,
} from "../build-market-analysis-summary";

describe(
  "buildMarketAnalysisSummary",
  () => {
    it(
      "produces decision-ready narrative",
      () => {
        const summary =
          buildMarketAnalysisSummary({
            analysis: {
              subject: {
                address:
                  "123 Main St",
              },
            } as ComparableAnalysis,
            valuation: {
              valueRange: {
                low: 380000,
                estimated: 400000,
                high: 420000,
              },
              confidence: {
                level: "high",
                score: 84,
              },
              supportingComparables: [
                {},
                {},
                {},
              ],
              excludedComparableIds: [
                "outlier",
              ],
            } as unknown as
              MarketValuation,
          });

        expect(summary)
          .toContain(
            "$400,000",
          );

        expect(summary)
          .toContain(
            "high confidence",
          );

        expect(summary)
          .toContain(
            "1 outlier was excluded",
          );
      },
    );
  },
);
