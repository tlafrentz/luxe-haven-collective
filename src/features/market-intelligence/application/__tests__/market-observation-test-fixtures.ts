import {
  ComparableAnalysis,
} from "../../domain/entities/comparable-analysis";

import {
  ComparableProperty,
} from "../../domain/entities/comparable-property";

import {
  ComparableSubject,
} from "../../domain/entities/comparable-subject";

import {
  MarketAnalysisReport,
} from "../../domain/entities/market-analysis-report";

import {
  MarketValuation,
} from "../../domain/entities/market-valuation";

import {
  WeightedComparable,
} from "../../domain/entities/weighted-comparable";

import {
  ProviderType,
} from "../../domain/enums/provider-type";

import {
  ComparableWeight,
} from "../../domain/value-objects/comparable-weight";

import {
  ConfidenceScore,
} from "../../domain/value-objects/confidence-score";

import {
  DataProvenance,
} from "../../domain/value-objects/data-provenance";

import {
  MarketAnalysisEvidence,
} from "../../domain/value-objects/market-analysis-evidence";

import {
  MarketAnalysisFinding,
} from "../../domain/value-objects/market-analysis-finding";

import {
  MarketValueRange,
} from "../../domain/value-objects/market-value-range";

import {
  SimilarityScore,
} from "../../domain/value-objects/similarity-score";

import {
  ValuationConfidence,
} from "../../domain/value-objects/valuation-confidence";

export const GENERATED_AT =
  new Date("2026-07-19T16:00:00.000Z");

export function createComparableSubject():
  ComparableSubject {
  return new ComparableSubject({
    id: "property-001",
    address:
      "123 Main Street, Mesa, AZ",
    propertyType: "single-family",
    bedrooms: 3,
    bathrooms: 2,
    squareFeet: 1800,
    yearBuilt: 2018,
  });
}

export function createWeightedComparable({
  id,
  value,
  similarity,
  weight,
}: {
  id: string;
  value: number;
  similarity: number;
  weight: number;
}): WeightedComparable {
  return new WeightedComparable({
    comparable:
      new ComparableProperty({
        id,
        address:
          `${id} Comparable Street, Mesa, AZ`,
        estimatedValue: value,
        squareFeet: 1750,
        distanceMiles: 1.2,
        provenance:
          new DataProvenance(
            ProviderType.RentCast,
            GENERATED_AT,
            new ConfidenceScore(85),
            10,
          ),
      }),
    similarityScore:
      new SimilarityScore(
        similarity,
      ),
    weight:
      new ComparableWeight(weight),
    baseValue: value,
  });
}

export function createComparableAnalysis():
  ComparableAnalysis {
  return new ComparableAnalysis({
    subject:
      createComparableSubject(),
    comparables: [
      createWeightedComparable({
        id: "comparable-001",
        value: 400000,
        similarity: 85,
        weight: 0.6,
      }),
      createWeightedComparable({
        id: "comparable-002",
        value: 425000,
        similarity: 75,
        weight: 0.4,
      }),
    ],
    analyzedAt: GENERATED_AT,
  });
}

export function createMarketValuation():
  MarketValuation {
  const analysis =
    createComparableAnalysis();

  return new MarketValuation({
    valueRange:
      new MarketValueRange({
        low: 395000,
        estimated: 410000,
        high: 430000,
      }),
    averagePricePerSquareFoot: 230,
    medianPricePerSquareFoot: 228,
    weightedPricePerSquareFoot: 227.78,
    confidence:
      new ValuationConfidence({
        score: 82,
        comparableCount: 2,
        averageSimilarity: 80,
        dispersionRatio: 0.08,
        reasons: [],
      }),
    supportingComparables:
      analysis.comparables,
    excludedComparableIds: [
      "comparable-outlier",
    ],
    calculatedAt: GENERATED_AT,
  });
}

export function createMarketAnalysisReport():
  MarketAnalysisReport {
  return new MarketAnalysisReport({
    analysis:
      createComparableAnalysis(),
    valuation:
      createMarketValuation(),
    summary:
      "The property has a supported market value near $410,000.",
    findings: [
      new MarketAnalysisFinding({
        type: "strength",
        title:
          "Strong valuation support",
        description:
          "Comparable evidence supports the estimated value.",
        severity: "low",
      }),
      new MarketAnalysisFinding({
        type: "risk",
        title:
          "Limited comparable set",
        description:
          "Only two usable comparables were available.",
        severity: "moderate",
      }),
    ],
    evidence: [
      new MarketAnalysisEvidence({
        type: "subject-property",
        label: "Subject address",
        value:
          "123 Main Street, Mesa, AZ",
      }),
      new MarketAnalysisEvidence({
        type: "provider",
        label: "Property provider",
        value: "RentCast",
        source: "rentcast",
      }),
    ],
    generatedAt: GENERATED_AT,
  });
}
