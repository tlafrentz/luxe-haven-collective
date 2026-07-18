import { describe, expect, it } from "vitest";

import { ConfidenceScore } from "../value-objects/confidence-score";
import { MarketScore } from "../value-objects/market-score";
import { PropertyIntelligence } from "./property-intelligence";

describe("PropertyIntelligence", () => {
  it("creates a complete property intelligence result", () => {
    const result = PropertyIntelligence.create({
      propertyId: "property-1",
      propertyType: "single-family",
      bedrooms: 3,
      bathrooms: 2,
      squareFeet: 1800,
      yearBuilt: 2020,
      valuation: {
        low: 450000,
        estimated: 475000,
        high: 500000,
        currency: "USD",
      },
      estimatedPricePerSquareFoot: 263.89,
      propertyScore: MarketScore.create(82),
      confidence: new ConfidenceScore(90),
      strengths: ["Recent construction"],
      executiveSummary: "The property has a strong physical profile.",
    });

    expect(result.hasCompletePhysicalProfile).toBe(true);
    expect(result.hasValuation).toBe(true);
    expect(result.hasMaterialUnknowns).toBe(false);
  });

  it("rejects an inverted valuation range", () => {
    expect(() =>
      PropertyIntelligence.create({
        propertyId: "property-1",
        propertyType: "single-family",
        valuation: {
          low: 500000,
          estimated: 475000,
          high: 450000,
          currency: "USD",
        },
        propertyScore: MarketScore.create(50),
        confidence: new ConfidenceScore(50),
        executiveSummary: "Summary",
      }),
    ).toThrow();
  });
});
