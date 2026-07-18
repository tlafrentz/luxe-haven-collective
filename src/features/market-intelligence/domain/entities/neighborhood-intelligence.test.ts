import { describe, expect, it } from "vitest";

import { IntelligenceRating } from "../enums/intelligence-rating";
import { ConfidenceScore } from "../value-objects/confidence-score";
import { MarketScore } from "../value-objects/market-score";
import {
  NeighborhoodDimension,
  NeighborhoodIntelligence,
} from "./neighborhood-intelligence";

function dimension(value: number): NeighborhoodDimension {
  const score = MarketScore.create(value);

  return {
    score,
    rating: score.rating,
  };
}

describe("NeighborhoodIntelligence", () => {
  it("creates hospitality-focused neighborhood intelligence", () => {
    const result = NeighborhoodIntelligence.create({
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
      confidence: new ConfidenceScore(88),
      strengths: ["Strong dining access", "Good event demand"],
      risks: ["Moderate airport access"],
      executiveSummary: "The neighborhood is well suited to hospitality.",
    });

    expect(result.opportunityCount).toBe(2);
    expect(result.riskCount).toBe(1);
    expect(result.hasMaterialUnknowns).toBe(false);
  });

  it("rejects a rating that does not match its score", () => {
    const invalidDimension: NeighborhoodDimension = {
      score: MarketScore.create(90),
      rating: IntelligenceRating.Weak,
    };

    expect(() =>
      NeighborhoodIntelligence.create({
        neighborhoodName: "Downtown",
        walkability: invalidDimension,
        dining: dimension(80),
        entertainment: dimension(80),
        businessTravel: dimension(80),
        airportAccess: dimension(80),
        medicalAccess: dimension(80),
        universityAccess: dimension(80),
        conventionDemand: dimension(80),
        hospitalitySuitability: dimension(80),
        neighborhoodScore: MarketScore.create(80),
        confidence: new ConfidenceScore(80),
        executiveSummary: "Summary",
      }),
    ).toThrow();
  });
});
