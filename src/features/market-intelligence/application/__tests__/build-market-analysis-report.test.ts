import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  ComparableProperty,
} from "../../domain/entities/comparable-property";

import {
  ComparableAnalysis,
} from "../../domain/entities/comparable-analysis";

import {
  ComparableSubject,
} from "../../domain/entities/comparable-subject";

import {
  MarketValuation,
} from "../../domain/entities/market-valuation";

import {
  WeightedComparable,
} from "../../domain/entities/weighted-comparable";

import {
  ComparableWeight,
} from "../../domain/value-objects/comparable-weight";

import {
  MarketValueRange,
} from "../../domain/value-objects/market-value-range";

import {
  SimilarityScore,
} from "../../domain/value-objects/similarity-score";

import {
  ValuationConfidence,
} from "../../domain/value-objects/valuation-confidence";

import {
  buildMarketAnalysisReport,
} from "../build-market-analysis-report";

function createComparable(
  id: string,
  value: number,
  weight: number,
  similarity: number,
): WeightedComparable {
  return new WeightedComparable({
    comparable: {
      id,
      squareFeet: 2000,
    } as unknown as
      ComparableProperty,
    similarityScore:
      new SimilarityScore(
        similarity,
      ),
    weight:
      new ComparableWeight(
        weight,
      ),
    baseValue: value,
  });
}

describe(
  "buildMarketAnalysisReport",
  () => {
    it(
      "builds a complete explainable report",
      () => {
        const comparables = [
          createComparable(
            "comp-1",
            400000,
            0.5,
            90,
          ),
          createComparable(
            "comp-2",
            410000,
            0.3,
            85,
          ),
          createComparable(
            "comp-3",
            390000,
            0.2,
            80,
          ),
        ];

        const analysis =
          new ComparableAnalysis({
            subject:
              new ComparableSubject({
                address:
                  "123 Main St, Mesa, AZ",
                squareFeet: 2000,
              }),
            comparables,
          });

        const valuation =
          new MarketValuation({
            valueRange:
              new MarketValueRange({
                low: 395000,
                estimated: 401000,
                high: 405000,
              }),
            averagePricePerSquareFoot:
              200,
            medianPricePerSquareFoot:
              200,
            weightedPricePerSquareFoot:
              200.5,
            confidence:
              new ValuationConfidence({
                score: 86,
                comparableCount: 3,
                averageSimilarity: 85,
                dispersionRatio: 0.02,
              }),
            supportingComparables:
              comparables,
          });

        const report =
          buildMarketAnalysisReport({
            analysis,
            valuation,
            generatedAt:
              new Date(
                "2026-07-18T12:00:00.000Z",
              ),
          });

        expect(
          report.estimatedValue,
        ).toBe(401000);

        expect(
          report.confidenceLevel,
        ).toBe("high");

        expect(
          report.summary,
        ).toContain(
          "$401,000",
        );

        expect(
          report.findings.some(
            (finding) =>
              finding.type ===
              "strength",
          ),
        ).toBe(true);

        expect(
          report.evidence.some(
            (item) =>
              item.label ===
              "Weighted price per square foot",
          ),
        ).toBe(true);

        expect(
          report.generatedAt
            .toISOString(),
        ).toBe(
          "2026-07-18T12:00:00.000Z",
        );
      },
    );

    it(
      "surfaces risks and data gaps",
      () => {
        const comparable =
          createComparable(
            "comp-1",
            400000,
            1,
            45,
          );

        const analysis =
          new ComparableAnalysis({
            subject:
              new ComparableSubject({
                address:
                  "123 Main St",
              }),
            comparables: [
              comparable,
            ],
          });

        const valuation =
          new MarketValuation({
            valueRange:
              new MarketValueRange({
                low: 400000,
                estimated: 400000,
                high: 400000,
              }),
            confidence:
              new ValuationConfidence({
                score: 42,
                comparableCount: 1,
                averageSimilarity: 45,
                dispersionRatio: 0.3,
                reasons: [
                  "Limited evidence.",
                ],
              }),
            supportingComparables: [
              comparable,
            ],
          });

        const report =
          buildMarketAnalysisReport({
            analysis,
            valuation,
          });

        expect(
          report.riskCount,
        ).toBeGreaterThan(0);

        expect(
          report.dataGapCount,
        ).toBeGreaterThan(0);

        expect(
          report.findings.map(
            (finding) =>
              finding.title,
          ),
        ).toContain(
          "Limited comparable set",
        );
      },
    );
  },
);
