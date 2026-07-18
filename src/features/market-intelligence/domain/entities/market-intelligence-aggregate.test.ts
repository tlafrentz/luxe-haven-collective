import { describe, expect, it } from "vitest";

import { IntelligenceRating } from "../enums/intelligence-rating";
import { TrendDirection } from "../enums/trend-direction";
import { ConfidenceScore } from "../value-objects/confidence-score";
import { MarketScore } from "../value-objects/market-score";
import { ComparableIntelligence } from "./comparable-intelligence";
import { DemandIntelligence } from "./demand-intelligence";
import { ExecutiveMarketSummary } from "./executive-market-summary";
import { MarketConfidence } from "./market-confidence";
import { MarketIntelligenceAggregate } from "./market-intelligence-aggregate";
import { MarketTrendIntelligence } from "./market-trend-intelligence";
import {
  NeighborhoodDimension,
  NeighborhoodIntelligence,
} from "./neighborhood-intelligence";
import { PropertyIntelligence } from "./property-intelligence";
import { SupplyIntelligence } from "./supply-intelligence";

function dimension(value: number): NeighborhoodDimension {
  const score = MarketScore.create(value);

  return {
    score,
    rating: score.rating,
  };
}

describe("MarketIntelligenceAggregate", () => {
  it("creates a decision-ready aggregate", () => {
    const property = PropertyIntelligence.create({
      propertyId: "property-1",
      propertyType: "single-family",
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1800,
      yearBuilt: 2020,
      propertyScore: MarketScore.create(80),
      confidence: new ConfidenceScore(85),
      executiveSummary: "The property profile is strong.",
    });

    const comparables = ComparableIntelligence.create({
      totalComparableCount: 5,
      strongMatchCount: 3,
      moderateMatchCount: 1,
      weakMatchCount: 1,
      excludedMatchCount: 0,
      averageSimilarity: 82,
      medianSimilarity: 84,
      comparableScore: MarketScore.create(84),
      confidence: new ConfidenceScore(90),
      executiveSummary: "Comparable evidence is sufficient.",
    });

    const neighborhood = NeighborhoodIntelligence.create({
      neighborhoodName: "Downtown",
      walkability: dimension(75),
      dining: dimension(85),
      entertainment: dimension(80),
      businessTravel: dimension(70),
      airportAccess: dimension(65),
      medicalAccess: dimension(60),
      universityAccess: dimension(55),
      conventionDemand: dimension(70),
      hospitalitySuitability: dimension(82),
      neighborhoodScore: MarketScore.create(76),
      confidence: new ConfidenceScore(80),
      executiveSummary: "The neighborhood supports hospitality demand.",
    });

    const supply = SupplyIntelligence.create({
      activeListingCount: 450,
      professionalOperatorSharePercent: 35,
      luxuryInventorySharePercent: 12,
      inventoryGrowthPercent: 4,
      saturationScore: MarketScore.create(60),
      competitionRating: IntelligenceRating.Moderate,
      supplyScore: MarketScore.create(68),
      confidence: new ConfidenceScore(75),
      executiveSummary: "Supply is competitive but manageable.",
    });

    const demand = DemandIntelligence.create({
      occupancyPercent: 71,
      averageDailyRate: 185,
      revenuePerAvailableNight: 131.35,
      bookingPacePercent: 68,
      weekendStrength: IntelligenceRating.Strong,
      weekdayStrength: IntelligenceRating.Moderate,
      seasonalityStrength: IntelligenceRating.Moderate,
      demandOutlook: TrendDirection.Positive,
      demandScore: MarketScore.create(79),
      confidence: new ConfidenceScore(82),
      executiveSummary: "Demand remains resilient.",
    });

    const trends = MarketTrendIntelligence.create({
      averageDailyRateTrend: TrendDirection.Positive,
      occupancyTrend: TrendDirection.Stable,
      revenueTrend: TrendDirection.Positive,
      inventoryTrend: TrendDirection.Positive,
      pricingPowerTrend: TrendDirection.Positive,
      demandTrend: TrendDirection.Positive,
      overallDirection: TrendDirection.Positive,
      momentumScore: MarketScore.create(78),
      confidence: new ConfidenceScore(77),
      executiveSummary: "Market momentum is positive.",
    });

    const confidence = MarketConfidence.create({
      overall: new ConfidenceScore(80),
      property: new ConfidenceScore(85),
      comparables: new ConfidenceScore(90),
      neighborhood: new ConfidenceScore(80),
      supply: new ConfidenceScore(75),
      demand: new ConfidenceScore(82),
      trends: new ConfidenceScore(77),
      providerCoveragePercent: 90,
      executiveSummary: "Confidence is high across the report.",
    });

    const executiveSummary = ExecutiveMarketSummary.create({
      headline: "Healthy market with resilient demand",
      summary:
        "The market shows strong comparable support, positive momentum, and manageable competition.",
      strengths: ["Resilient demand", "Strong comparable evidence"],
      risks: ["Inventory is increasing"],
      recommendedFocus: ["Validate operating assumptions"],
    });

    const aggregate = MarketIntelligenceAggregate.create({
      reportId: "report-1",
      generatedAt: new Date("2026-07-18T12:00:00.000Z"),
      marketName: "Mesa, Arizona",
      property,
      comparables,
      neighborhood,
      supply,
      demand,
      trends,
      confidence,
      executiveSummary,
      overallMarketScore: MarketScore.create(79),
    });

    expect(aggregate.isDecisionReady).toBe(true);
    expect(aggregate.hasMaterialUnknowns).toBe(false);
    expect(aggregate.marketName).toBe("Mesa, Arizona");
  });

  it("rejects an invalid generated date", () => {
    expect(() =>
      MarketIntelligenceAggregate.create({
        reportId: "report-1",
        generatedAt: new Date("invalid"),
        marketName: "Mesa, Arizona",
        property: {} as PropertyIntelligence,
        comparables: {} as ComparableIntelligence,
        neighborhood: {} as NeighborhoodIntelligence,
        supply: {} as SupplyIntelligence,
        demand: {} as DemandIntelligence,
        trends: {} as MarketTrendIntelligence,
        confidence: {} as MarketConfidence,
        executiveSummary: {} as ExecutiveMarketSummary,
        overallMarketScore: MarketScore.create(50),
      }),
    ).toThrow();
  });
});
