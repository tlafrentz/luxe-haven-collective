import { describe, expect, it } from "vitest";

import { buildMarketConfidence } from "../builders/build-market-confidence";

describe("buildMarketConfidence", () => {
  it("builds weighted confidence and identifies the weakest dimension", () => {
    const confidence = buildMarketConfidence({
      propertyScore: 90,
      comparablesScore: 82,
      neighborhoodScore: 76,
      supplyScore: 72,
      demandScore: 88,
      trendsScore: 80,
      providerCoveragePercent: 86,
    });

    expect(confidence.overall.value).toBeGreaterThan(75);
    expect(confidence.weakestDimension.name).toBe("supply");
    expect(confidence.explanations).toContain(
      "Supply evidence is the weakest confidence dimension at 72.",
    );
    expect(confidence.hasMaterialGaps).toBe(false);
  });

  it("penalizes missing data and conflicting evidence", () => {
    const confidence = buildMarketConfidence({
      propertyScore: 80,
      comparablesScore: 80,
      neighborhoodScore: 80,
      supplyScore: 80,
      demandScore: 80,
      trendsScore: 80,
      providerCoveragePercent: 50,
      missingData: [
        "Professional operator share",
        "Booking pace",
      ],
      conflictingSignalCount: 2,
    });

    expect(confidence.overall.value).toBeLessThan(80);
    expect(confidence.hasMaterialGaps).toBe(true);
    expect(confidence.executiveSummary).toContain(
      "2 material data gaps remain",
    );
  });

  it("preserves an explicit overall score and explanations", () => {
    const confidence = buildMarketConfidence({
      propertyScore: 60,
      comparablesScore: 60,
      neighborhoodScore: 60,
      supplyScore: 60,
      demandScore: 60,
      trendsScore: 60,
      overallScore: 75,
      explanations: ["Manual review increased confidence."],
    });

    expect(confidence.overall.value).toBe(75);
    expect(confidence.explanations).toEqual([
      "Manual review increased confidence.",
    ]);
  });
});
