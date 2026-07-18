import { describe, expect, it } from "vitest";

import { buildDemandIntelligence } from "../builders/build-demand-intelligence";
import { TrendDirection } from "../../domain/enums/trend-direction";

describe("buildDemandIntelligence", () => {
  it("builds demand intelligence from market performance metrics", () => {
    const intelligence = buildDemandIntelligence({
      occupancyPercent: 72,
      averageDailyRate: 245,
      revenuePerAvailableNight: 176.4,
      bookingPacePercent: 74,
      weekendStrengthScore: 84,
      weekdayStrengthScore: 71,
      seasonalityStrengthScore: 76,
      demandOutlook: TrendDirection.Positive,
      confidenceScore: 88,
    });

    expect(intelligence.hasCorePerformanceMetrics).toBe(true);
    expect(intelligence.demandScore.value).toBeGreaterThan(70);
    expect(intelligence.strengths).toContain(
      "Occupancy indicates healthy market demand.",
    );
    expect(intelligence.strengths).toContain(
      "Weekday demand reduces reliance on leisure weekends.",
    );
    expect(intelligence.executiveSummary).toContain("$245 ADR");
  });

  it("detects weak demand and missing core metrics", () => {
    const intelligence = buildDemandIntelligence({
      occupancyPercent: 38,
      weekendStrengthScore: 35,
      weekdayStrengthScore: 28,
      seasonalityStrengthScore: 30,
      demandOutlook: TrendDirection.Negative,
      confidenceScore: 62,
    });

    expect(intelligence.hasCorePerformanceMetrics).toBe(false);
    expect(intelligence.risks).toContain(
      "Low occupancy indicates weak demand absorption.",
    );
    expect(intelligence.missingInformation).toContain(
      "Average daily rate",
    );
  });
});
