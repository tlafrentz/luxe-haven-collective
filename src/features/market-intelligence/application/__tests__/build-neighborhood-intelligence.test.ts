import { describe, expect, it } from "vitest";

import { buildNeighborhoodIntelligence } from "../builders/build-neighborhood-intelligence";

describe("buildNeighborhoodIntelligence", () => {
  it("builds neighborhood intelligence and derives strengths and risks", () => {
    const intelligence = buildNeighborhoodIntelligence({
      neighborhoodName: "Downtown Mesa",
      walkability: { score: 78 },
      dining: { score: 86 },
      entertainment: { score: 80 },
      businessTravel: { score: 72 },
      airportAccess: { score: 65 },
      medicalAccess: { score: 60 },
      universityAccess: { score: 58 },
      conventionDemand: { score: 35 },
      hospitalitySuitability: { score: 82 },
      confidenceScore: 80,
    });

    expect(intelligence.neighborhoodName).toBe("Downtown Mesa");
    expect(intelligence.neighborhoodScore.value).toBeCloseTo(68.44, 2);
    expect(intelligence.strengths).toContain(
      "Dining is a market strength.",
    );
    expect(intelligence.risks).toContain(
      "Convention Demand may limit demand.",
    );
    expect(intelligence.executiveSummary).toContain("Downtown Mesa");
  });

  it("preserves explicit strengths and risks", () => {
    const intelligence = buildNeighborhoodIntelligence({
      neighborhoodName: "Test District",
      walkability: { score: 50 },
      dining: { score: 50 },
      entertainment: { score: 50 },
      businessTravel: { score: 50 },
      airportAccess: { score: 50 },
      medicalAccess: { score: 50 },
      universityAccess: { score: 50 },
      conventionDemand: { score: 50 },
      hospitalitySuitability: { score: 50 },
      confidenceScore: 60,
      strengths: ["Strong local identity."],
      risks: ["Limited transit options."],
      missingInformation: ["Event demand history"],
    });

    expect(intelligence.strengths).toEqual(["Strong local identity."]);
    expect(intelligence.risks).toEqual(["Limited transit options."]);
    expect(intelligence.hasMaterialUnknowns).toBe(true);
  });
});
