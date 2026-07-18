import { describe, expect, it } from "vitest";

import { buildExecutiveMarketSummary } from "../builders/build-executive-market-summary";
import { buildMarketConfidence } from "../builders/build-market-confidence";

describe("buildExecutiveMarketSummary", () => {
  it("synthesizes intelligence sections into an executive view", () => {
    const confidence = buildMarketConfidence({
      propertyScore: 88,
      comparablesScore: 84,
      neighborhoodScore: 82,
      supplyScore: 74,
      demandScore: 90,
      trendsScore: 86,
      providerCoveragePercent: 90,
    });

    const summary = buildExecutiveMarketSummary({
      marketName: "Downtown Mesa",
      property: {
        executiveSummary:
          "The subject property has a complete physical profile.",
        strengths: ["The subject property is recently built."],
      },
      comparables: {
        executiveSummary:
          "Comparable evidence supports the current valuation range.",
        strengths: ["Comparable coverage is strong."],
      },
      neighborhood: {
        executiveSummary:
          "The neighborhood supports hospitality demand.",
        strengths: ["Dining is a market strength."],
      },
      supply: {
        executiveSummary:
          "Supply remains competitive but manageable.",
        opportunities: [
          "Limited luxury inventory may create room for premium positioning.",
        ],
        risks: ["Inventory growth should be monitored."],
      },
      demand: {
        executiveSummary:
          "Demand is healthy across weekday and weekend periods.",
        strengths: ["Occupancy indicates healthy market demand."],
      },
      trends: {
        executiveSummary:
          "Market momentum is positive.",
        supportingSignals: ["Revenue is strongly positive."],
      },
      confidence,
    });

    expect(summary.headline).toContain("Downtown Mesa");
    expect(summary.summary).toContain(
      "Market momentum is positive.",
    );
    expect(summary.strengths).toContain(
      "Comparable coverage is strong.",
    );
    expect(summary.opportunities).toContain(
      "Limited luxury inventory may create room for premium positioning.",
    );
    expect(summary.recommendedFocus.length).toBeGreaterThan(0);
  });

  it("deduplicates conclusions and limits section length", () => {
    const confidence = buildMarketConfidence({
      propertyScore: 70,
      comparablesScore: 70,
      neighborhoodScore: 70,
      supplyScore: 70,
      demandScore: 70,
      trendsScore: 70,
    });

    const repeatedStrength =
      "Demand supports the operating strategy.";

    const section = {
      executiveSummary: "Evidence is balanced.",
      strengths: [repeatedStrength],
    };

    const summary = buildExecutiveMarketSummary({
      property: section,
      comparables: section,
      neighborhood: section,
      supply: section,
      demand: section,
      trends: section,
      confidence,
      maximumItemsPerSection: 3,
    });

    expect(summary.strengths).toEqual([repeatedStrength]);
    expect(summary.strengths.length).toBeLessThanOrEqual(3);
  });

  it("preserves explicit executive conclusions", () => {
    const confidence = buildMarketConfidence({
      propertyScore: 65,
      comparablesScore: 65,
      neighborhoodScore: 65,
      supplyScore: 65,
      demandScore: 65,
      trendsScore: 65,
    });

    const section = {
      executiveSummary: "Underlying evidence is available.",
    };

    const summary = buildExecutiveMarketSummary({
      property: section,
      comparables: section,
      neighborhood: section,
      supply: section,
      demand: section,
      trends: section,
      confidence,
      headline: "Proceed with conditions",
      summary: "The opportunity is viable with targeted diligence.",
      strengths: ["Strong location."],
      risks: ["Supply is increasing."],
      opportunities: ["Premium positioning."],
      unknowns: ["Regulatory outlook"],
      recommendedFocus: ["Validate local regulation."],
    });

    expect(summary.headline).toBe("Proceed with conditions");
    expect(summary.summary).toBe(
      "The opportunity is viable with targeted diligence.",
    );
    expect(summary.recommendedFocus).toEqual([
      "Validate local regulation.",
    ]);
  });
});
